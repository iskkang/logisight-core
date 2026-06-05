/**
 * Collect live maritime risk data and store the normalized snapshot in Supabase.
 *
 * Intended runtime: Render Cron Job.
 *
 * Required env:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "Required env vars missing: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_KEY",
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const PORTS_URL =
  "https://www.econdb.com/maritime/search/ports/?page_size=20&page=1&s=&fl=rank%2Cname%2Clocode%2Clast_import_teu%2Clast_export_teu%2Cimport_dwell_time%2Cexport_dwell_time%2Cts_dwell_time%2Cschedule%2Ctransshipments%2Creefer%2Cport_congestion%2Cdelay_percent%2Cregion%2Cvessels_berthed%2Cturnaround%2Clast_export_teu_mom%2Clast_import_teu_mom%2Cglobal_trade%2Ccountry%2Cid%2Crank";
const GLOBAL_EXPORTS_URL =
  "https://www.econdb.com/widgets/global-trade/data/?type=export&net=0&transform=0&freq=month";
const SCFI_URL = "https://www.econdb.com/widgets/shanghai-containerized-index/data/";
const GLOBAL_LIFTINGS_URL = "https://www.econdb.com/widgets/global-seasonal/data/";
const GULF_STATS_URL = "https://www.shipfinder.com/Special/ShipsInPersianGulfStats";
const HORMUZ_NEWS_URL = "https://www.shipfinder.com/Special/GetHormuzNewsRecent?skip=0&limit=6";
const MACRO_INDEX_URL = "https://www.shipfinder.com/Special/GetMacroIndexLatest";
const CHOKEPOINTS = ["Suez", "Panama", "Cape", "Malacca", "Hormuz"];
const ECONDB_HEADERS = {
  accept: "application/json, text/plain, */*",
  "accept-language": "en-US,en;q=0.9,ko;q=0.8",
  referer: "https://www.econdb.com/",
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
};
const SHIPFINDER_HEADERS = {
  accept: "application/json, text/plain, */*",
  "user-agent": "Mozilla/5.0",
};

async function fetchJson(url, timeoutMs = 12000) {
  try {
    const res = await fetch(url, {
      headers: url.includes("shipfinder.com") ? SHIPFINDER_HEADERS : ECONDB_HEADERS,
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      const message =
        res.status === 403 ? "HTTP 403: source rejected server-side request" : `HTTP ${res.status}`;
      return { ok: false, message, asOf: null };
    }
    return { ok: true, data: await res.json(), asOf: null };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error),
      asOf: null,
    };
  }
}

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function str(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function num(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function dateOnly(value) {
  const s = str(value);
  return s ? s.slice(0, 10) : null;
}

function pctChange(latest, previous) {
  if (latest == null || previous == null || previous === 0) return null;
  return ((latest - previous) / Math.abs(previous)) * 100;
}

function avg(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function sumNumericFields(row, skipKeys = new Set(["Date"])) {
  const values = Object.entries(row)
    .filter(([key]) => !skipKeys.has(key))
    .map(([, value]) => num(value))
    .filter((value) => value !== null);
  return values.length ? values.reduce((sum, value) => sum + value, 0) : null;
}

function latestPastRows(rows, dateKey) {
  const tomorrow = Date.now() + 24 * 60 * 60 * 1000;
  return rows.filter((row) => {
    const rawDate = str(row[dateKey]);
    if (!rawDate) return true;
    const time = new Date(rawDate.replace(" ", "T")).getTime();
    return Number.isNaN(time) || time <= tomorrow;
  });
}

function health(source, result, asOf = null) {
  return result.ok
    ? { source, ok: true, asOf }
    : { source, ok: false, message: result.message, asOf: null };
}

function parsePorts(data) {
  return arr(obj(obj(data).response).docs).map((entry) => {
    const row = obj(entry);
    return {
      rank: num(row.rank),
      name: str(row.name) ?? "Unknown",
      locode: str(row.locode),
      country: str(row.country),
      region: str(row.region),
      delayPercent: num(row.delay_percent),
      congestion: num(row.port_congestion),
      importDwell: num(row.import_dwell_time),
      exportDwell: num(row.export_dwell_time),
      transshipDwell: num(row.ts_dwell_time),
      turnaround: num(row.turnaround),
      vesselsBerthed: num(row.vessels_berthed),
      schedule: num(row.schedule),
      importTeu: num(row.last_import_teu),
      exportTeu: num(row.last_export_teu),
      importTeuMom: num(row.last_import_teu_mom),
      exportTeuMom: num(row.last_export_teu_mom),
      globalTrade: num(row.global_trade),
    };
  });
}

function parsePlotData(data) {
  const firstPlot = obj(arr(obj(data).plots)[0]);
  return arr(firstPlot.data).map(obj);
}

function parseSeries(data) {
  const firstPlot = obj(arr(obj(data).plots)[0]);
  return new Map(
    arr(firstPlot.series).map((entry) => {
      const row = obj(entry);
      const code = str(row.code) ?? "";
      return [code, str(row.name) ?? code];
    }),
  );
}

async function getChokepoint(name) {
  const dataUrl = `https://www.econdb.com/widgets/chokepoint-pass/data/?unit=teu&group_by=direction&chokepoint_name=${name}`;
  const crossingsUrl = `https://www.econdb.com/maritime/latest_crossings/?chokepoint_name=${name}`;
  const [flowResult, crossingsResult] = await Promise.all([
    fetchJson(dataUrl),
    fetchJson(crossingsUrl),
  ]);
  const rows = flowResult.ok ? parsePlotData(flowResult.data) : [];
  const series = flowResult.ok ? parseSeries(flowResult.data) : new Map();
  const totals = rows.map((row) => sumNumericFields(row));
  const latest = rows.at(-1) ?? {};
  const latestTotal = totals.at(-1) ?? null;
  const previousTotal = totals.at(-2) ?? null;
  const crossingRows = crossingsResult.ok
    ? latestPastRows(arr(obj(crossingsResult.data).data).map(obj), "start_date")
    : [];
  const topCrossing = [...crossingRows].sort((a, b) => (num(b.teu) ?? 0) - (num(a.teu) ?? 0))[0];

  return {
    row: {
      name,
      asOf: dateOnly(latest.Date),
      latestTotalTeu: latestTotal,
      previousTotalTeu: previousTotal,
      wowPct: pctChange(latestTotal, previousTotal),
      avg8w: avg(totals.slice(-8).filter((value) => value !== null)),
      latestCrossings: crossingRows.length,
      topCrossingName: topCrossing ? str(topCrossing.name) : null,
      topCrossingTeu: topCrossing ? num(topCrossing.teu) : null,
      directions: [...series.entries()].map(([code, label]) => ({
        code,
        name: label,
        value: num(latest[code]),
      })),
      spark: totals.slice(-14),
      sourceUrl: dataUrl,
    },
    health: [
      health(`${name} TEU flow`, flowResult, dateOnly(latest.Date)),
      health(`${name} latest crossings`, crossingsResult, dateOnly(crossingRows[0]?.start_date)),
    ],
  };
}

function yesterdayIso() {
  const d = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

function parseGulfStats(data) {
  const rows = arr(obj(data).data).map(obj);
  const counts = rows.map((row) => num(row.ship_cnt));
  const latest = rows.at(-1);
  return {
    asOf: latest ? (dateOnly(latest.dt_header) ?? dateOnly(latest.dt)) : null,
    gulfShipCount: counts.at(-1) ?? null,
    gulfShipWowPct: pctChange(counts.at(-1) ?? null, counts.at(-8) ?? null),
    gulfShipSpark: counts.slice(-21),
  };
}

function parseHormuzCrossings(data, crossingDate) {
  const rows = arr(obj(data).data).map(obj);
  let eastbound = 0;
  let westbound = 0;
  let tankerCount = 0;
  let bulkCount = 0;
  let totalDwt = 0;
  for (const row of rows) {
    const direction = num(row.direction);
    if (direction === 0) eastbound += 1;
    else if (direction === 1) westbound += 1;
    const shiptype = `${str(row.shiptype) ?? ""} ${str(row.shiptype_en) ?? ""}`.toLowerCase();
    if (shiptype.includes("油") || shiptype.includes("tanker")) tankerCount += 1;
    if (shiptype.includes("散") || shiptype.includes("bulk")) bulkCount += 1;
    totalDwt += num(row.dwt) ?? 0;
  }
  return {
    crossingDate,
    crossingCount: rows.length,
    eastbound,
    westbound,
    tankerCount,
    bulkCount,
    totalDwt: totalDwt > 0 ? totalDwt : null,
  };
}

function parseMacroIndex(data) {
  return arr(obj(data).data)
    .map(obj)
    .map((row) => ({
      label: str(row.DateType) ?? "Macro",
      asOf: dateOnly(row.DataDate),
      value: num(row.IndicatorValue),
      change: str(row.ChangeRate),
    }));
}

function parseHormuzNews(data) {
  return arr(obj(data).data)
    .map(obj)
    .map((row) => ({
      title: str(row.title) ?? "Untitled",
      source: str(row.source),
      url: str(row.url),
      publishedAt: dateOnly(row.news_time),
      summary: str(row.summary),
    }));
}

async function getHormuzRisk() {
  const crossingDate = yesterdayIso();
  const crossingUrl = `https://www.shipfinder.com/Special/CrossStraitOfHormuzDetail?date=${crossingDate}`;
  const [gulfResult, crossingResult, macroResult, newsResult] = await Promise.all([
    fetchJson(GULF_STATS_URL),
    fetchJson(crossingUrl),
    fetchJson(MACRO_INDEX_URL),
    fetchJson(HORMUZ_NEWS_URL),
  ]);
  const gulf = gulfResult.ok
    ? parseGulfStats(gulfResult.data)
    : { asOf: null, gulfShipCount: null, gulfShipWowPct: null, gulfShipSpark: [] };
  const crossings = crossingResult.ok
    ? parseHormuzCrossings(crossingResult.data, crossingDate)
    : {
        crossingDate,
        crossingCount: 0,
        eastbound: 0,
        westbound: 0,
        tankerCount: 0,
        bulkCount: 0,
        totalDwt: null,
      };
  const macro = macroResult.ok ? parseMacroIndex(macroResult.data) : [];
  const news = newsResult.ok ? parseHormuzNews(newsResult.data) : [];
  return {
    row: { ...gulf, ...crossings, macro, news },
    health: [
      health("Persian Gulf ship count", gulfResult, gulf.asOf),
      health("Hormuz crossing detail", crossingResult, crossingDate),
      health("Shipfinder macro index", macroResult, macro[0]?.asOf ?? null),
      health("Hormuz recent news", newsResult, news[0]?.publishedAt ?? null),
    ],
  };
}

function trendFromRows(label, rows, valueKey, source) {
  const filtered = rows.filter((row) => num(row[valueKey]) !== null);
  const values = filtered.map((row) => num(row[valueKey]));
  const latest = values.at(-1) ?? null;
  const previous = values.at(-2) ?? null;
  return {
    label,
    asOf: dateOnly(filtered.at(-1)?.Date),
    latest,
    previous,
    changePct: pctChange(latest, previous),
    spark: values.slice(-18),
    source,
  };
}

function parseGlobalLiftings(data) {
  const rows = parsePlotData(data);
  const latestYear =
    [...new Set(rows.flatMap((row) => Object.keys(row).filter((key) => /^\d{4}$/.test(key))))]
      .sort()
      .at(-1) ?? new Date().getFullYear().toString();
  return trendFromRows("Global TEU liftings", rows, latestYear, "EconDB global seasonal");
}

async function getMacroTrends() {
  const [exportsResult, scfiResult, liftingsResult] = await Promise.all([
    fetchJson(GLOBAL_EXPORTS_URL),
    fetchJson(SCFI_URL),
    fetchJson(GLOBAL_LIFTINGS_URL),
  ]);
  const exportsRows = exportsResult.ok ? parsePlotData(exportsResult.data) : [];
  const scfiRows = scfiResult.ok ? parsePlotData(scfiResult.data) : [];
  const liftingsRows = liftingsResult.ok ? parsePlotData(liftingsResult.data) : [];
  return {
    rows: [
      trendFromRows("Global exports TEU", exportsRows, "Total", "EconDB global trade"),
      trendFromRows("Shanghai freight index", scfiRows, "price", "EconDB SCFI"),
      liftingsResult.ok
        ? parseGlobalLiftings(liftingsResult.data)
        : trendFromRows("Global TEU liftings", [], "2026", "EconDB global seasonal"),
    ],
    health: [
      health("Global exports TEU", exportsResult, dateOnly(exportsRows.at(-1)?.Date)),
      health("Shanghai freight index", scfiResult, dateOnly(scfiRows.at(-1)?.Date)),
      health("Global TEU liftings", liftingsResult, dateOnly(liftingsRows.at(-1)?.Date)),
    ],
  };
}

async function collectRiskSnapshot() {
  const [portsResult, chokepointResults, hormuzResult, macroResult] = await Promise.all([
    fetchJson(PORTS_URL),
    Promise.all(CHOKEPOINTS.map((name) => getChokepoint(name))),
    getHormuzRisk(),
    getMacroTrends(),
  ]);
  return {
    fetchedAt: new Date().toISOString(),
    sourceHealth: [
      health("EconDB top ports", portsResult, null),
      ...chokepointResults.flatMap((result) => result.health),
      ...hormuzResult.health,
      ...macroResult.health,
    ],
    ports: portsResult.ok ? parsePorts(portsResult.data) : [],
    chokepoints: chokepointResults.map((result) => result.row),
    hormuz: hormuzResult.row,
    macroTrends: macroResult.rows,
  };
}

async function main() {
  console.log("Collecting maritime risk snapshot...");
  const snapshot = await collectRiskSnapshot();
  const okCount = snapshot.sourceHealth.filter((source) => source.ok).length;
  const warnCount = snapshot.sourceHealth.length - okCount;
  console.log(`Source health: ${okCount} OK / ${warnCount} WARN`);
  for (const source of snapshot.sourceHealth) {
    console.log(
      `${source.ok ? "OK" : "WARN"} ${source.source}${source.ok ? "" : ` - ${source.message}`}`,
    );
  }

  const { error } = await supabase.from("risk_snapshots").upsert({
    id: "latest",
    snapshot,
    source: "render-risk-collector",
    collected_at: snapshot.fetchedAt,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    console.error("Supabase upsert failed:", error.message);
    process.exit(1);
  }

  console.log(`Stored risk_snapshots/latest at ${snapshot.fetchedAt}`);
}

main();

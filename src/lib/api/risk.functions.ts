import { createServerFn } from "@tanstack/react-start";

import type {
  ChokepointRiskRow,
  HormuzRisk,
  MacroRiskRow,
  MacroTrend,
  NewsRiskRow,
  PortRiskRow,
  RiskSnapshot,
  SourceHealth,
} from "./risk";

const PORTS_URL =
  "https://www.econdb.com/maritime/search/ports/?page_size=20&page=1&s=&fl=rank%2Cname%2Clocode%2Clast_import_teu%2Clast_export_teu%2Cimport_dwell_time%2Cexport_dwell_time%2Cts_dwell_time%2Cschedule%2Ctransshipments%2Creefer%2Cport_congestion%2Cdelay_percent%2Cregion%2Cvessels_berthed%2Cturnaround%2Clast_export_teu_mom%2Clast_import_teu_mom%2Cglobal_trade%2Ccountry%2Cid%2Crank";
const GLOBAL_EXPORTS_URL =
  "https://www.econdb.com/widgets/global-trade/data/?type=export&net=0&transform=0&freq=month";
const SCFI_URL = "https://www.econdb.com/widgets/shanghai-containerized-index/data/";
const GLOBAL_LIFTINGS_URL = "https://www.econdb.com/widgets/global-seasonal/data/";
const GULF_STATS_URL = "https://www.shipfinder.com/Special/ShipsInPersianGulfStats";
const HORMUZ_NEWS_URL = "https://www.shipfinder.com/Special/GetHormuzNewsRecent?skip=0&limit=6";
const MACRO_INDEX_URL = "https://www.shipfinder.com/Special/GetMacroIndexLatest";
const CHOKEPOINTS = ["Suez", "Panama", "Cape", "Malacca", "Hormuz"] as const;

type JsonObject = Record<string, unknown>;

type FetchResult<T> =
  | { ok: true; data: T; asOf: string | null }
  | { ok: false; message: string; asOf: null };

async function fetchJson<T>(url: string, timeoutMs = 8000): Promise<FetchResult<T>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { accept: "application/json,text/plain,*/*" },
      signal: controller.signal,
    });
    if (!res.ok) return { ok: false, message: `HTTP ${res.status}`, asOf: null };
    return { ok: true, data: (await res.json()) as T, asOf: null };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error),
      asOf: null,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function obj(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : {};
}

function arr(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function dateOnly(value: unknown): string | null {
  const s = str(value);
  return s ? s.slice(0, 10) : null;
}

function pctChange(latest: number | null, previous: number | null): number | null {
  if (latest == null || previous == null || previous === 0) return null;
  return ((latest - previous) / Math.abs(previous)) * 100;
}

function avg(values: number[]): number | null {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function sumNumericFields(row: JsonObject, skipKeys = new Set(["Date"])): number | null {
  const values = Object.entries(row)
    .filter(([key]) => !skipKeys.has(key))
    .map(([, value]) => num(value))
    .filter((value): value is number => value !== null);
  return values.length ? values.reduce((sum, value) => sum + value, 0) : null;
}

function latestPastRows(rows: JsonObject[], dateKey: string): JsonObject[] {
  const tomorrow = Date.now() + 24 * 60 * 60 * 1000;
  return rows.filter((row) => {
    const rawDate = str(row[dateKey]);
    if (!rawDate) return true;
    const time = new Date(rawDate.replace(" ", "T")).getTime();
    return Number.isNaN(time) || time <= tomorrow;
  });
}

function health(
  source: string,
  result: FetchResult<unknown>,
  asOf: string | null = null,
): SourceHealth {
  return result.ok
    ? { source, ok: true, asOf }
    : { source, ok: false, message: result.message, asOf: null };
}

function parsePorts(data: unknown): PortRiskRow[] {
  const docs = arr(obj(obj(data).response).docs);
  return docs.map((entry) => {
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

function parsePlotData(data: unknown): JsonObject[] {
  const firstPlot = obj(arr(obj(data).plots)[0]);
  return arr(firstPlot.data).map(obj);
}

function parseSeries(data: unknown): Map<string, string> {
  const firstPlot = obj(arr(obj(data).plots)[0]);
  return new Map(
    arr(firstPlot.series).map((entry) => {
      const row = obj(entry);
      const code = str(row.code) ?? "";
      return [code, str(row.name) ?? code];
    }),
  );
}

async function getChokepoint(name: (typeof CHOKEPOINTS)[number]): Promise<{
  row: ChokepointRiskRow;
  health: SourceHealth[];
}> {
  const dataUrl = `https://www.econdb.com/widgets/chokepoint-pass/data/?unit=teu&group_by=direction&chokepoint_name=${name}`;
  const crossingsUrl = `https://www.econdb.com/maritime/latest_crossings/?chokepoint_name=${name}`;
  const [flowResult, crossingsResult] = await Promise.all([
    fetchJson<unknown>(dataUrl),
    fetchJson<unknown>(crossingsUrl),
  ]);

  const rows = flowResult.ok ? parsePlotData(flowResult.data) : [];
  const series = flowResult.ok ? parseSeries(flowResult.data) : new Map<string, string>();
  const totals = rows.map((row) => sumNumericFields(row));
  const latest = rows.at(-1) ?? {};
  const previousTotal = totals.at(-2) ?? null;
  const latestTotal = totals.at(-1) ?? null;
  const crossingRows = crossingsResult.ok
    ? latestPastRows(arr(obj(crossingsResult.data).data).map(obj), "start_date")
    : [];
  const topCrossing = [...crossingRows].sort((a, b) => (num(b.teu) ?? 0) - (num(a.teu) ?? 0))[0];

  const directions = [...series.entries()].map(([code, label]) => ({
    code,
    name: label,
    value: num(latest[code]),
  }));

  return {
    row: {
      name,
      asOf: dateOnly(latest.Date),
      latestTotalTeu: latestTotal,
      previousTotalTeu: previousTotal,
      wowPct: pctChange(latestTotal, previousTotal),
      avg8w: avg(totals.slice(-8).filter((value): value is number => value !== null)),
      latestCrossings: crossingRows.length,
      topCrossingName: topCrossing ? str(topCrossing.name) : null,
      topCrossingTeu: topCrossing ? num(topCrossing.teu) : null,
      directions,
      spark: totals.slice(-14),
      sourceUrl: dataUrl,
    },
    health: [
      health(`${name} TEU flow`, flowResult, dateOnly(latest.Date)),
      health(`${name} latest crossings`, crossingsResult, dateOnly(crossingRows[0]?.start_date)),
    ],
  };
}

function yesterdayIso(): string {
  const d = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

function parseGulfStats(
  data: unknown,
): Pick<HormuzRisk, "asOf" | "gulfShipCount" | "gulfShipWowPct" | "gulfShipSpark"> {
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

function parseHormuzCrossings(
  data: unknown,
  crossingDate: string,
): Pick<
  HormuzRisk,
  | "crossingDate"
  | "crossingCount"
  | "eastbound"
  | "westbound"
  | "tankerCount"
  | "bulkCount"
  | "totalDwt"
> {
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

function parseMacroIndex(data: unknown): MacroRiskRow[] {
  return arr(obj(data).data)
    .map(obj)
    .map((row) => ({
      label: str(row.DateType) ?? "Macro",
      asOf: dateOnly(row.DataDate),
      value: num(row.IndicatorValue),
      change: str(row.ChangeRate),
    }));
}

function parseHormuzNews(data: unknown): NewsRiskRow[] {
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

async function getHormuzRisk(): Promise<{ row: HormuzRisk; health: SourceHealth[] }> {
  const crossingDate = yesterdayIso();
  const crossingUrl = `https://www.shipfinder.com/Special/CrossStraitOfHormuzDetail?date=${crossingDate}`;
  const [gulfResult, crossingResult, macroResult, newsResult] = await Promise.all([
    fetchJson<unknown>(GULF_STATS_URL),
    fetchJson<unknown>(crossingUrl),
    fetchJson<unknown>(MACRO_INDEX_URL),
    fetchJson<unknown>(HORMUZ_NEWS_URL),
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
    row: {
      ...gulf,
      ...crossings,
      macro,
      news,
    },
    health: [
      health("Persian Gulf ship count", gulfResult, gulf.asOf),
      health("Hormuz crossing detail", crossingResult, crossingDate),
      health("Shipfinder macro index", macroResult, macro[0]?.asOf ?? null),
      health("Hormuz recent news", newsResult, news[0]?.publishedAt ?? null),
    ],
  };
}

function trendFromRows(
  label: string,
  rows: JsonObject[],
  valueKey: string,
  source: string,
): MacroTrend {
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

function parseGlobalLiftings(data: unknown): MacroTrend {
  const rows = parsePlotData(data);
  const latestYear =
    [...new Set(rows.flatMap((row) => Object.keys(row).filter((key) => /^\d{4}$/.test(key))))]
      .sort()
      .at(-1) ?? new Date().getFullYear().toString();
  return trendFromRows("Global TEU liftings", rows, latestYear, "EconDB global seasonal");
}

async function getMacroTrends(): Promise<{ rows: MacroTrend[]; health: SourceHealth[] }> {
  const [exportsResult, scfiResult, liftingsResult] = await Promise.all([
    fetchJson<unknown>(GLOBAL_EXPORTS_URL),
    fetchJson<unknown>(SCFI_URL),
    fetchJson<unknown>(GLOBAL_LIFTINGS_URL),
  ]);
  const exportsRows = exportsResult.ok ? parsePlotData(exportsResult.data) : [];
  const scfiRows = scfiResult.ok ? parsePlotData(scfiResult.data) : [];
  const liftingsRows = liftingsResult.ok ? parsePlotData(liftingsResult.data) : [];

  const rows = [
    trendFromRows("Global exports TEU", exportsRows, "Total", "EconDB global trade"),
    trendFromRows("Shanghai freight index", scfiRows, "price", "EconDB SCFI"),
    liftingsResult.ok
      ? parseGlobalLiftings(liftingsResult.data)
      : trendFromRows("Global TEU liftings", [], "2026", "EconDB global seasonal"),
  ];

  return {
    rows,
    health: [
      health("Global exports TEU", exportsResult, dateOnly(exportsRows.at(-1)?.Date)),
      health("Shanghai freight index", scfiResult, dateOnly(scfiRows.at(-1)?.Date)),
      health("Global TEU liftings", liftingsResult, dateOnly(liftingsRows.at(-1)?.Date)),
    ],
  };
}

export const getRiskSnapshot = createServerFn({ method: "GET" }).handler(
  async (): Promise<RiskSnapshot> => {
    const [portsResult, chokepointResults, hormuzResult, macroResult] = await Promise.all([
      fetchJson<unknown>(PORTS_URL),
      Promise.all(CHOKEPOINTS.map((name) => getChokepoint(name))),
      getHormuzRisk(),
      getMacroTrends(),
    ]);

    const ports = portsResult.ok ? parsePorts(portsResult.data) : [];
    const sourceHealth: SourceHealth[] = [
      health("EconDB top ports", portsResult, null),
      ...chokepointResults.flatMap((result) => result.health),
      ...hormuzResult.health,
      ...macroResult.health,
    ];

    return {
      fetchedAt: new Date().toISOString(),
      sourceHealth,
      ports,
      chokepoints: chokepointResults.map((result) => result.row),
      hormuz: hormuzResult.row,
      macroTrends: macroResult.rows,
    };
  },
);

// 현재 지연 지도 — 운영 추적(FESCO + TCR) 현재 컨테이너 지연.
// 원본 컨테이너 행은 노출하지 않고 delay_current_snapshot 집계 뷰만 표시한다.
import { useMemo, useState, type ReactNode } from "react";
import { ComposableMap, Geographies, Geography, Line as MapLine, Marker } from "react-simple-maps";

import { cityMeta } from "@/lib/eurasia-geo";
import type {
  OperationalCurrentDelay,
  SourceState,
  SourceStatus,
} from "@/lib/api/operational-delay";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";
const W = 980;
const H = 560;
const PRIMARY_BLUE = "#2563eb";
const DELAY_RED = "#dc2626";
const TCR_GRAY = "#64748b";

type SourceSystem = "FESCO" | "TCR";
type Chip = "all" | "fesco" | "tcr_rail" | "tcr_rail_truck";

const CHIPS: { key: Chip; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "fesco", label: "FESCO · TSR" },
  { key: "tcr_rail", label: "TCR · 중국 철도" },
  { key: "tcr_rail_truck", label: "TCR · 중국 철도+트럭" },
];

const DEFAULT_SOURCE: Record<SourceSystem, SourceStatus> = {
  FESCO: { source_system: "FESCO", state: "view_missing", rows: 0 },
  TCR: { source_system: "TCR", state: "view_missing", rows: 0 },
};

const STATE_LABEL: Record<SourceState, string> = {
  active: "정상",
  empty: "0건 (상세 데이터 없음)",
  view_missing: "뷰 미생성",
  error: "오류",
};

const STATE_TEXT_CLASS: Record<SourceState, string> = {
  active: "text-emerald-700",
  empty: "text-amber-700",
  view_missing: "text-slate-500",
  error: "text-red-700",
};

type Mapped = OperationalCurrentDelay & { lng: number; lat: number };
type Fit = { center: [number, number]; scale: number };
type RouteLine = {
  from: [number, number];
  to: [number, number];
  fromLabel: string;
  toLabel: string;
};

function getSource(sources: SourceStatus[], system: SourceSystem): SourceStatus {
  return sources.find((s) => s.source_system === system) ?? DEFAULT_SOURCE[system];
}

function statusText(source: SourceStatus): string {
  return source.state === "active" ? `정상 · ${source.rows}건` : STATE_LABEL[source.state];
}

function sourceDisplayName(system: SourceSystem): string {
  return system === "FESCO" ? "FESCO · TSR" : "TCR · 중국";
}

export function OperationalSourceStatusBar({
  sources,
  className = "",
}: {
  sources: SourceStatus[];
  className?: string;
}) {
  const fesco = getSource(sources, "FESCO");
  const tcr = getSource(sources, "TCR");

  return (
    <div
      className={`flex flex-wrap items-center gap-x-2 gap-y-1 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-[12px] shadow-sm ${className}`}
    >
      <span className="font-semibold text-slate-700">소스 상태</span>
      <span className="text-slate-300">·</span>
      {[fesco, tcr].map((source, index) => (
        <span key={source.source_system} className="inline-flex items-center gap-x-2">
          {index > 0 && <span className="text-slate-300">·</span>}
          <span className="font-medium text-slate-800">
            {sourceDisplayName(source.source_system)}:
          </span>
          <span className={`font-semibold tabular-nums ${STATE_TEXT_CLASS[source.state]}`}>
            {statusText(source)}
          </span>
        </span>
      ))}
    </div>
  );
}

function passesChip(record: OperationalCurrentDelay, chip: Chip): boolean {
  if (chip === "all") return true;
  if (chip === "fesco") return record.source_system === "FESCO";
  if (chip === "tcr_rail") {
    return record.source_system === "TCR" && record.transport_mode === "CHINA_RAIL";
  }
  return record.source_system === "TCR" && record.transport_mode === "CHINA_RAIL_TRUCK";
}

function sourceLabel(
  record: Pick<OperationalCurrentDelay, "source_system" | "transport_mode">,
): string {
  if (record.source_system === "FESCO") return "FESCO · TSR";
  return record.transport_mode === "CHINA_RAIL_TRUCK" ? "TCR · 중국 철도+트럭" : "TCR · 중국 철도";
}

function delayOf(record: OperationalCurrentDelay): number {
  return Math.max(
    0,
    Math.round(record.alert_delay_days ?? record.max_delay_days ?? record.median_delay_days ?? 0),
  );
}

function affectedContainers(record: OperationalCurrentDelay): number {
  return Math.max(0, record.active_delayed_count || record.container_count || 0);
}

function routeLabel(record: OperationalCurrentDelay): string {
  const fallback = [record.current_from ?? record.origin, record.current_to ?? record.destination]
    .filter(Boolean)
    .join(" → ");
  return record.route_label || fallback || "경로 미확인";
}

function splitRouteLabel(label: string): [string, string] | null {
  const parts = label
    .split(/\s*(?:→|->|—|–|~|\sto\s)\s*/i)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length < 2) return null;
  return [parts[0], parts[parts.length - 1]];
}

function endpointLabels(record: OperationalCurrentDelay): [string, string] | null {
  const directFrom = record.current_from ?? record.origin;
  const directTo = record.current_to ?? record.destination ?? record.location_name;
  if (directFrom && directTo) return [directFrom, directTo];
  return splitRouteLabel(routeLabel(record));
}

function routeLineFor(record: OperationalCurrentDelay | null): RouteLine | null {
  if (!record) return null;
  const endpoints = endpointLabels(record);
  if (!endpoints) return null;
  const [fromLabel, toLabel] = endpoints;
  const from = cityMeta(fromLabel);
  const to = cityMeta(toLabel);
  if (!from || !to) return null;
  return {
    from: from.coords,
    to: to.coords,
    fromLabel,
    toLabel,
  };
}

function fitProjection(coords: [number, number][]): Fit {
  if (coords.length === 0) return { center: [88, 47], scale: 380 };
  const lngs = coords.map((coord) => coord[0]);
  const lats = coords.map((coord) => coord[1]);
  const center: [number, number] = [
    (Math.min(...lngs) + Math.max(...lngs)) / 2,
    (Math.min(...lats) + Math.max(...lats)) / 2,
  ];
  const spanLng = Math.max(Math.max(...lngs) - Math.min(...lngs), 10);
  const spanLat = Math.max(Math.max(...lats) - Math.min(...lats), 8);
  const rad = Math.PI / 180;
  return {
    center,
    scale: Math.max(190, Math.min((W * 0.86) / (spanLng * rad), (H * 0.8) / (spanLat * rad), 760)),
  };
}

function markerRadius(record: OperationalCurrentDelay): number {
  return Math.max(7, Math.min(15, 7 + Math.sqrt(Math.max(affectedContainers(record), 1)) * 1.15));
}

function isTcrChip(chip: Chip): boolean {
  return chip === "tcr_rail" || chip === "tcr_rail_truck";
}

function tcrCallout(tcr: SourceStatus): { title: string; body: string } | null {
  if (tcr.state === "view_missing") {
    return {
      title: "TCR 미연동 — 뷰 미생성",
      body: "TCR 데이터는 현재 연동되지 않았습니다. 연결 및 뷰 생성을 진행 중입니다.",
    };
  }
  if (tcr.state === "empty") {
    return {
      title: "TCR · 중국: 0건 (상세 데이터 없음)",
      body: "TCR detail tables are empty. This is expected until the ingestion pipeline populates data.",
    };
  }
  if (tcr.state === "error") {
    return {
      title: "TCR · 중국: 오류",
      body: tcr.message ?? "TCR 현재 지연 뷰를 조회하는 중 오류가 발생했습니다.",
    };
  }
  return null;
}

function legendTcrLabel(tcr: SourceStatus): string {
  return `TCR · 중국 (${tcr.state === "active" ? "정상" : STATE_LABEL[tcr.state]})`;
}

export function OperationalCurrentDelayMap({
  records,
  sources,
}: {
  records: OperationalCurrentDelay[];
  sources: SourceStatus[];
}) {
  const [chip, setChip] = useState<Chip>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);

  const fescoStatus = getSource(sources, "FESCO");
  const tcrStatus = getSource(sources, "TCR");
  const tcrAvailable =
    tcrStatus.state === "active" && records.some((record) => record.source_system === "TCR");
  const fescoAvailable =
    fescoStatus.state === "active" && records.some((record) => record.source_system === "FESCO");

  const chipCounts = useMemo(
    () =>
      CHIPS.reduce<Record<Chip, number>>(
        (acc, item) => {
          acc[item.key] = records.filter((record) => passesChip(record, item.key)).length;
          return acc;
        },
        { all: records.length, fesco: 0, tcr_rail: 0, tcr_rail_truck: 0 },
      ),
    [records],
  );

  const filtered = useMemo(
    () =>
      records.filter((record) => passesChip(record, chip)).sort((a, b) => delayOf(b) - delayOf(a)),
    [records, chip],
  );

  const mapped = useMemo(() => {
    return filtered
      .map((record): Mapped | null => {
        const meta = cityMeta(
          record.location_name ?? record.current_to ?? record.destination ?? "",
        );
        return meta ? { ...record, lng: meta.coords[0], lat: meta.coords[1] } : null;
      })
      .filter((record): record is Mapped => record !== null)
      .sort((a, b) => delayOf(b) - delayOf(a));
  }, [filtered]);

  const mainFesco = useMemo(
    () =>
      records
        .filter((record) => record.source_system === "FESCO")
        .sort((a, b) => delayOf(b) - delayOf(a))[0] ?? null,
    [records],
  );

  const routeLine = chip === "all" || chip === "fesco" ? routeLineFor(mainFesco) : null;
  const fit = useMemo(() => {
    const coords = mapped.map((record): [number, number] => [record.lng, record.lat]);
    if (routeLine) coords.push(routeLine.from, routeLine.to);
    return fitProjection(coords);
  }, [mapped, routeLine]);

  const topRows = filtered.slice(0, 6);
  const bestRecord = filtered[0] ?? null;
  const popupRecord =
    mapped.find((record) => record.id === selectedId) ??
    mapped.find((record) => record.id === mainFesco?.id) ??
    mapped[0] ??
    null;
  const popupDelay = popupRecord ? delayOf(popupRecord) : 0;
  const tcrInfo = tcrCallout(tcrStatus);

  const kpi = useMemo(() => {
    const maxRecord = filtered[0] ?? null;
    return {
      routes: filtered.length,
      totalDelay: filtered.reduce((sum, record) => sum + delayOf(record), 0),
      containers: filtered.reduce((sum, record) => sum + affectedContainers(record), 0),
      maxDelay: maxRecord ? delayOf(maxRecord) : 0,
      maxRoute: maxRecord ? routeLabel(maxRecord) : "—",
    };
  }, [filtered]);

  const hasMapGraphic = mapped.length > 0 || routeLine !== null;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-[18px] border border-blue-100 bg-blue-50/70 px-4 py-3 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" aria-hidden />
          <span className="font-bold text-slate-800">소스 상태</span>
          <span className="text-slate-300">·</span>
          <span className="font-medium text-slate-800">FESCO · TSR:</span>
          <span className={`font-bold tabular-nums ${STATE_TEXT_CLASS[fescoStatus.state]}`}>
            {statusText(fescoStatus)}
          </span>
          <span className="text-slate-300">·</span>
          <span className="font-medium text-slate-800">TCR · 중국:</span>
          <span className={`font-bold tabular-nums ${STATE_TEXT_CLASS[tcrStatus.state]}`}>
            {statusText(tcrStatus)}
          </span>
          <span
            className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 text-[10px] font-bold text-slate-500"
            title={tcrStatus.message ?? "현재 소스별 집계 뷰 상태"}
          >
            i
          </span>
        </div>

        <div className="flex flex-wrap gap-2 lg:justify-end">
          {CHIPS.map((item) => {
            const disabled =
              (item.key === "fesco" && !fescoAvailable) || (isTcrChip(item.key) && !tcrAvailable);
            const active = chip === item.key;
            return (
              <button
                key={item.key}
                type="button"
                disabled={disabled}
                title={disabled && isTcrChip(item.key) ? statusText(tcrStatus) : undefined}
                onClick={() => {
                  setChip(item.key);
                  setSelectedId(null);
                }}
                className={[
                  "inline-flex h-10 items-center gap-1.5 rounded-xl border px-4 text-[13px] font-extrabold transition",
                  active
                    ? "border-blue-600 bg-white text-blue-700 shadow-sm shadow-blue-600/10 ring-1 ring-blue-500"
                    : "border-slate-200 bg-white text-slate-800 shadow-sm hover:border-blue-200 hover:bg-blue-50",
                  disabled
                    ? "cursor-not-allowed bg-slate-100 text-slate-400 opacity-70 ring-0 hover:border-slate-200 hover:bg-slate-100"
                    : "",
                ].join(" ")}
              >
                {item.label}
                <span className={active ? "text-blue-500" : "text-slate-400"}>
                  {chipCounts[item.key]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(430px,0.95fr)]">
        <section className="overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-[0_14px_45px_rgba(15,23,42,0.08)]">
          <div className="flex h-14 items-center justify-between gap-3 border-b border-slate-100 px-5">
            <div>
              <h2 className="text-[15px] font-bold text-slate-950">유라시아 노선 현황</h2>
            </div>
            <div className="flex items-center gap-2 text-[12px] font-medium text-slate-500">
              <span>마지막 업데이트: 5분 전</span>
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-500">
                ↻
              </span>
            </div>
          </div>

          <div className="relative min-h-[620px] overflow-hidden bg-[#dbeafe]">
            <div
              aria-hidden
              className="absolute inset-0 opacity-70"
              style={{
                background:
                  "radial-gradient(circle at 22% 20%, rgba(255,255,255,0.8), transparent 24%), radial-gradient(circle at 72% 66%, rgba(255,255,255,0.52), transparent 28%), linear-gradient(135deg, rgba(219,234,254,0.95), rgba(239,246,255,0.72))",
              }}
            />
            {!hasMapGraphic ? (
              <div className="relative flex min-h-[620px] items-center justify-center px-6 text-center">
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    현재 운영 지연 데이터가 없습니다.
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    FESCO/TCR 소스 상태를 확인하세요. TCR은 연동 전이면 회색 비활성 상태로
                    유지됩니다.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <ComposableMap
                  projection="geoMercator"
                  projectionConfig={{ center: fit.center, scale: fit.scale }}
                  width={W}
                  height={H}
                  style={{ width: "100%", height: "100%", position: "relative", zIndex: 1 }}
                >
                  <Geographies geography={GEO_URL}>
                    {({ geographies }) =>
                      geographies.map((geo) => (
                        <Geography
                          key={geo.rsmKey}
                          geography={geo}
                          fill="#f8fafc"
                          stroke="#cbd5e1"
                          strokeWidth={0.45}
                          style={{
                            default: { outline: "none" },
                            hover: { outline: "none" },
                            pressed: { outline: "none" },
                          }}
                        />
                      ))
                    }
                  </Geographies>

                  {routeLine && (
                    <>
                      <MapLine
                        from={routeLine.from}
                        to={routeLine.to}
                        stroke={PRIMARY_BLUE}
                        strokeWidth={5}
                        strokeLinecap="round"
                        strokeOpacity={0.16}
                      />
                      <MapLine
                        from={routeLine.from}
                        to={routeLine.to}
                        stroke={PRIMARY_BLUE}
                        strokeWidth={2.7}
                        strokeLinecap="round"
                        strokeDasharray="7 5"
                      />
                    </>
                  )}

                  {mapped.map((record, index) => {
                    const isTcr = record.source_system === "TCR";
                    const active = selectedId === record.id || hoverId === record.id;
                    const showLabel = active || index < 3;
                    const r = markerRadius(record);
                    const color = isTcr ? TCR_GRAY : PRIMARY_BLUE;
                    return (
                      <Marker
                        key={record.id}
                        coordinates={[record.lng, record.lat]}
                        onClick={() =>
                          setSelectedId((current) => (current === record.id ? null : record.id))
                        }
                        onMouseEnter={() => setHoverId(record.id)}
                        onMouseLeave={() =>
                          setHoverId((current) => (current === record.id ? null : current))
                        }
                        style={{ default: { cursor: "pointer" }, hover: { cursor: "pointer" } }}
                      >
                        {active &&
                          (isTcr ? (
                            <rect
                              x={-(r + 7)}
                              y={-(r + 7)}
                              width={(r + 7) * 2}
                              height={(r + 7) * 2}
                              transform="rotate(45)"
                              fill={color}
                              fillOpacity={0.14}
                              stroke={color}
                              strokeOpacity={0.35}
                            />
                          ) : (
                            <circle
                              r={r + 8}
                              fill={color}
                              fillOpacity={0.14}
                              stroke={color}
                              strokeOpacity={0.35}
                            />
                          ))}
                        {isTcr ? (
                          <rect
                            x={-r}
                            y={-r}
                            width={r * 2}
                            height={r * 2}
                            transform="rotate(45)"
                            fill={color}
                            fillOpacity={0.7}
                            stroke="#fff"
                            strokeWidth={1.6}
                          />
                        ) : (
                          <circle
                            r={r}
                            fill={color}
                            fillOpacity={0.96}
                            stroke="#fff"
                            strokeWidth={1.8}
                          />
                        )}
                        {showLabel && (
                          <text
                            x={r + 7}
                            y={4}
                            className="fill-slate-800 text-[10px] font-bold"
                            style={{ pointerEvents: "none" }}
                          >
                            {`${record.location_name ?? record.current_to ?? routeLabel(record)} +${delayOf(record)}일`}
                          </text>
                        )}
                        <title>{`${sourceLabel(record)}\n${routeLabel(record)}\n운영 지연 +${delayOf(record)}일 · ${affectedContainers(record)} containers`}</title>
                      </Marker>
                    );
                  })}
                </ComposableMap>

                <div className="pointer-events-none absolute left-[49%] top-[26%] z-10 text-xl font-bold text-slate-500/80">
                  러시아
                </div>
                <div className="pointer-events-none absolute left-[35%] top-[54%] z-10 text-sm font-bold text-slate-500/70">
                  카자흐스탄
                </div>
                <div className="pointer-events-none absolute left-[55%] top-[67%] z-10 text-sm font-bold text-slate-500/70">
                  중국
                </div>

                {routeLine && (
                  <div className="pointer-events-none absolute left-4 top-4 z-10 rounded-full border border-blue-200 bg-white/90 px-3 py-1.5 text-[12px] font-semibold text-blue-700 shadow-sm backdrop-blur">
                    {routeLine.fromLabel} → {routeLine.toLabel}
                  </div>
                )}

                {popupRecord && (
                  <div className="absolute right-[11%] top-[12%] z-20 w-[265px] rounded-2xl border border-slate-200 bg-white/95 p-4 text-[12px] shadow-xl shadow-slate-900/15 backdrop-blur">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-medium text-slate-400">source</p>
                        <p className="font-extrabold text-blue-600">{sourceLabel(popupRecord)}</p>
                        <p className="mt-3 text-[11px] font-medium text-slate-400">route</p>
                        <h3 className="mt-1 text-sm font-bold leading-snug text-slate-950">
                          {routeLabel(popupRecord)}
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedId(null)}
                        className="rounded-full px-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        aria-label="닫기"
                      >
                        x
                      </button>
                    </div>
                    <div className="mt-4 space-y-2">
                      {popupRecord.original_expected_arrival_date && (
                        <InfoRow
                          label="최초 도착 예정일"
                          value={popupRecord.original_expected_arrival_date}
                        />
                      )}
                      {popupRecord.current_eta && (
                        <InfoRow label="현재 ETA" value={popupRecord.current_eta} />
                      )}
                      <InfoRow label="운영 지연" value={`+${popupDelay}일`} strong tone="danger" />
                      <InfoRow
                        label="영향 컨테이너"
                        value={`${affectedContainers(popupRecord)} containers`}
                      />
                    </div>
                  </div>
                )}

                <div className="absolute bottom-7 left-6 z-10 overflow-hidden rounded-xl border border-slate-200 bg-white/95 text-slate-700 shadow-lg shadow-slate-900/10">
                  <button
                    type="button"
                    className="block h-11 w-11 border-b border-slate-200 text-xl font-bold"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    className="block h-11 w-11 border-b border-slate-200 text-xl font-bold"
                  >
                    −
                  </button>
                  <button type="button" className="block h-11 w-11 text-lg font-bold">
                    ⌖
                  </button>
                </div>

                <div className="absolute bottom-7 right-6 z-10 rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 text-[13px] shadow-lg shadow-slate-900/10 backdrop-blur">
                  <div className="flex items-center gap-2 py-0.5 text-slate-700">
                    <span className="h-4 w-4 rounded-full border-[3px] border-blue-600 bg-blue-50" />
                    FESCO · TSR (
                    {fescoStatus.state === "active" ? "정상" : STATE_LABEL[fescoStatus.state]})
                  </div>
                  <div className="flex items-center gap-2 py-0.5 text-slate-600">
                    <span className="h-4 w-4 rotate-45 border border-slate-500 bg-slate-300" />
                    {legendTcrLabel(tcrStatus)}
                  </div>
                </div>
              </>
            )}
          </div>
        </section>

        <aside className="grid content-start gap-4">
          <section className="rounded-[20px] border border-slate-200 bg-white p-4 shadow-[0_14px_45px_rgba(15,23,42,0.08)]">
            <div className="flex items-center justify-between">
              <h2 className="text-[16px] font-extrabold text-slate-950">현재 운영 지연</h2>
              <button className="rounded-lg border border-slate-200 px-3 py-1.5 text-[12px] font-semibold text-slate-500">
                기준: 현재 ETA ▾
              </button>
            </div>
            <div className="mt-4 grid grid-cols-4 gap-2">
              <MetricTile label="지연 노선" value={`${kpi.routes}`} />
              <MetricTile label="총 운영 지연" value={`+${kpi.totalDelay}일`} tone="danger" />
              <MetricTile label="영향 컨테이너" value={`${kpi.containers}`} />
              <MetricTile
                label="최대 지연"
                value={`+${kpi.maxDelay}일`}
                subtext={kpi.maxRoute}
                tone="danger"
              />
            </div>
          </section>

          <section className="rounded-[20px] border border-slate-200 bg-white p-4 shadow-[0_14px_45px_rgba(15,23,42,0.08)]">
            <div className="flex items-center justify-between">
              <h2 className="text-[16px] font-extrabold text-slate-950">Top Current Delays</h2>
              <button className="text-[13px] font-bold text-blue-600">전체 보기 →</button>
            </div>
            <div className="mt-3 overflow-hidden rounded-xl border border-slate-100">
              <table className="w-full border-collapse text-[12px]">
                <thead className="bg-slate-50 text-[11px] font-semibold text-slate-500">
                  <tr>
                    <th className="px-2.5 py-2 text-left">순위</th>
                    <th className="px-2.5 py-2 text-left">노선</th>
                    <th className="px-2.5 py-2 text-right">운영 지연</th>
                    <th className="px-2.5 py-2 text-right">영향 컨테이너</th>
                  </tr>
                </thead>
                <tbody>
                  {topRows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-6 text-center text-slate-500">
                        표시할 현재 지연 노선이 없습니다.
                      </td>
                    </tr>
                  ) : (
                    topRows.map((record, index) => (
                      <tr key={record.id} className="border-t border-slate-100">
                        <td className="px-2.5 py-2 text-slate-500">{index + 1}</td>
                        <td className="max-w-[180px] px-2.5 py-2">
                          <div className="truncate font-semibold text-slate-800">
                            {routeLabel(record)}
                          </div>
                          <div className="truncate text-[10px] text-slate-400">
                            {sourceLabel(record)}
                          </div>
                        </td>
                        <td className="px-2.5 py-2 text-right font-bold tabular-nums text-red-700">
                          +{delayOf(record)}일
                        </td>
                        <td className="px-2.5 py-2 text-right font-semibold tabular-nums text-slate-700">
                          {affectedContainers(record)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-[20px] border border-slate-200 bg-white p-4 shadow-[0_14px_45px_rgba(15,23,42,0.08)]">
            <h2 className="text-[16px] font-extrabold text-slate-950">소스 상태</h2>
            <div className="mt-3 space-y-2 text-[12px]">
              <SourceStatusRow label="FESCO · TSR:" source={fescoStatus} />
              <SourceStatusRow label="TCR · 중국:" source={tcrStatus} />
            </div>
            {tcrInfo && (
              <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[12px]">
                <p className="font-bold text-slate-800">{tcrInfo.title}</p>
                <p className="mt-1 leading-relaxed text-slate-500">{tcrInfo.body}</p>
              </div>
            )}
          </section>

          <section className="rounded-[20px] border border-slate-200 bg-white p-4 shadow-[0_14px_45px_rgba(15,23,42,0.08)]">
            <h2 className="text-[16px] font-extrabold text-slate-950">범례</h2>
            <div className="mt-3 grid gap-3 text-[13px] text-slate-600 sm:grid-cols-2">
              <div className="flex items-center gap-2">
                <span className="h-8 w-8 rounded-full border-[4px] border-blue-600 bg-blue-50" />
                FESCO = circle
              </div>
              <div className="flex items-center gap-2">
                <span className="h-8 w-8 rotate-45 border border-slate-500 bg-slate-300" />
                TCR = diamond
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function MetricTile({
  label,
  value,
  subtext,
  tone = "default",
}: {
  label: string;
  value: string;
  subtext?: string;
  tone?: "default" | "danger";
}) {
  return (
    <div className="min-h-[86px] rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2.5">
      <p className="text-[11px] font-semibold text-slate-500">{label}</p>
      <p
        className={`mt-1 text-2xl font-extrabold leading-tight tabular-nums ${
          tone === "danger" ? "text-red-700" : "text-slate-950"
        }`}
      >
        {value}
      </p>
      {subtext && <p className="mt-1 truncate text-[11px] text-slate-500">{subtext}</p>}
    </div>
  );
}

function InfoRow({
  label,
  value,
  strong,
  tone,
}: {
  label: string;
  value: ReactNode;
  strong?: boolean;
  tone?: "danger";
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-slate-500">{label}</span>
      <span
        className={[
          "text-right tabular-nums",
          strong ? "font-extrabold" : "font-semibold",
          tone === "danger" ? "text-red-700" : "text-slate-800",
        ].join(" ")}
      >
        {value}
      </span>
    </div>
  );
}

function SourceStatusRow({ label, source }: { label: string; source: SourceStatus }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
      <span className="font-semibold text-slate-700">{label}</span>
      <span className={`font-bold tabular-nums ${STATE_TEXT_CLASS[source.state]}`}>
        {statusText(source)}
      </span>
    </div>
  );
}

import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  Line,
} from "react-simple-maps"
import type { LaneRow, DelayWeeklyRow } from "@/lib/api/eurasia"

// World TopoJSON from public CDN (countries-110m)
const GEO_URL =
  "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json"

// ── Delay colour scale ──────────────────────────────────────────────
function delayColor(days: number | null | undefined): string {
  if (days == null) return "#475569"      // gray — no data
  if (days <= 0)    return "#10b981"      // emerald — on time
  if (days <= 3)    return "#f59e0b"      // amber — minor
  if (days <= 7)    return "#f97316"      // orange — moderate
  return "#ef4444"                         // red — severe
}

function delayLabel(days: number | null | undefined): string {
  if (days == null) return "데이터 없음"
  if (days <= 0)    return "정시"
  return `+${Math.round(days * 10) / 10}일`
}

// ── Corridor route polylines [lng, lat][] ───────────────────────────
// KR routes: Busan → Sea → Vladivostok → Trans-Sib → Novosibirsk → Semey → Almaty → destination
// CN routes: Qingdao → Urumqi → Khorgos → Almaty → destination

const KR_SHARED = [
  [129.07, 35.18] as [number, number],  // Busan
  [132.95, 42.83] as [number, number],  // Vladivostok
  [113.50, 52.04] as [number, number],  // Chita
  [82.92,  55.00] as [number, number],  // Novosibirsk
]
const CN_SHARED = [
  [120.37, 36.07] as [number, number],  // Qingdao
  [87.60,  43.80] as [number, number],  // Urumqi
  [80.19,  44.21] as [number, number],  // Khorgos
]

// Shared trunk from Novosibirsk south to Almaty via Semey (Trans-Kazakhstan railway)
const KR_CENTRAL_ASIA: [number, number][] = [
  ...KR_SHARED,
  [80.23,  50.41],  // Semey (Semipalatinsk)
  [76.90,  43.25],  // Almaty
]
// Shared trunk from Khorgos to Almaty (direct west)
const CN_CENTRAL_ASIA: [number, number][] = [
  ...CN_SHARED,
  [76.90,  43.25],  // Almaty
]

type LngLat = [number, number]

const CORRIDORS: {
  id: string
  coords: LngLat[]
}[] = [
  // KR routes (Trans-Siberian → Semey → Almaty → branch)
  {
    id: "KR-ALMATY",
    coords: [...KR_CENTRAL_ASIA],
  },
  {
    id: "KR-BISHKEK",
    coords: [...KR_CENTRAL_ASIA, [74.59, 42.87]],
  },
  {
    id: "KR-OSH",
    coords: [...KR_CENTRAL_ASIA, [74.59, 42.87], [72.80, 40.53]],
  },
  {
    id: "KR-CHUKURSAY",
    coords: [...KR_CENTRAL_ASIA, [69.60, 42.32], [69.30, 41.30]],  // via Shymkent → Tashkent
  },
  {
    id: "KR-ANDIJAN",
    coords: [...KR_CENTRAL_ASIA, [69.60, 42.32], [69.30, 41.30], [72.34, 40.78]],
  },
  {
    id: "KR-VLADIVOSTOK-CHUKURSAY",
    coords: [[129.07, 35.18], [132.95, 42.83], [69.30, 41.30]],
  },
  {
    id: "KR-VLADIVOSTOK-SILIKATNAJA",
    coords: [[129.07, 35.18], [132.95, 42.83], [37.45, 55.50]],
  },
  {
    id: "KR-VLADIVOSTOK-MOSCOW",
    coords: [[129.07, 35.18], [132.95, 42.83], [37.62, 55.75]],
  },
  {
    id: "KR-MALASZEWICZE",
    coords: [
      ...KR_SHARED,
      [60.60, 56.85],  // Yekaterinburg
      [37.62, 55.75],  // Moscow
      [23.69, 52.11],  // Malaszewicze
    ],
  },
  // CN routes (Khorgos → Almaty → branch)
  {
    id: "CN-ALMATY",
    coords: [...CN_CENTRAL_ASIA],
  },
  {
    id: "CN-BISHKEK",
    coords: [...CN_CENTRAL_ASIA, [74.59, 42.87]],
  },
  {
    id: "CN-OSH",
    coords: [...CN_CENTRAL_ASIA, [74.59, 42.87], [72.80, 40.53]],
  },
  {
    id: "CN-CHUKURSAY",
    coords: [...CN_CENTRAL_ASIA, [69.60, 42.32], [69.30, 41.30]],
  },
  {
    id: "CN-ANDIJAN",
    coords: [...CN_CENTRAL_ASIA, [69.60, 42.32], [69.30, 41.30], [72.34, 40.78]],
  },
]

// ── Key city nodes ──────────────────────────────────────────────────
const TRANSIT_NODES: { coords: LngLat; label: string }[] = [
  { coords: [132.95, 42.83], label: "Vladivostok" },
  { coords: [82.92,  55.00], label: "Novosibirsk" },
  { coords: [80.23,  50.41], label: "Semey" },
  { coords: [80.19,  44.21], label: "Khorgos" },
  { coords: [37.62,  55.75], label: "Moscow" },
]

const ORIGIN_NODES: { coords: LngLat; label: string }[] = [
  { coords: [129.07, 35.18], label: "Busan" },
  { coords: [120.37, 36.07], label: "Qingdao" },
]

const DEST_NODES: { laneId: string; coords: LngLat; label: string }[] = [
  { laneId: "KR-CHUKURSAY",    coords: [69.30, 41.30],  label: "Chukursay" },
  { laneId: "KR-VLADIVOSTOK-CHUKURSAY", coords: [69.30, 41.30], label: "FESCO Chukursay" },
  { laneId: "KR-VLADIVOSTOK-SILIKATNAJA", coords: [37.45, 55.50], label: "Silikatnaja" },
  { laneId: "KR-VLADIVOSTOK-MOSCOW", coords: [37.62, 55.75], label: "Moscow" },
  { laneId: "KR-ALMATY",       coords: [76.90, 43.25],  label: "Almaty" },
  { laneId: "KR-BISHKEK",      coords: [74.59, 42.87],  label: "Bishkek" },
  { laneId: "KR-ANDIJAN",      coords: [72.34, 40.78],  label: "Andijan" },
  { laneId: "KR-OSH",          coords: [72.80, 40.53],  label: "Osh" },
  { laneId: "KR-MALASZEWICZE", coords: [23.69, 52.11],  label: "Małaszewicze" },
  { laneId: "CN-ANDIJAN",      coords: [72.34, 40.78],  label: "" },   // merged with KR
  { laneId: "CN-BISHKEK",      coords: [74.59, 42.87],  label: "" },
  { laneId: "CN-ALMATY",       coords: [76.90, 43.25],  label: "" },
  { laneId: "CN-CHUKURSAY",    coords: [69.30, 41.30],  label: "" },
  { laneId: "CN-OSH",          coords: [72.80, 40.53],  label: "" },
]

// Destination city → lanes that feed it (for aggregated badge)
const DEST_CITIES: {
  key: string
  coords: LngLat
  label: string
  laneIds: string[]
}[] = [
  { key: "chukursay",    coords: [69.30, 41.30],  label: "Chukursay",    laneIds: ["KR-CHUKURSAY", "CN-CHUKURSAY"] },
  { key: "fesco-chukursay", coords: [69.30, 41.30], label: "FESCO Chukursay", laneIds: ["KR-VLADIVOSTOK-CHUKURSAY"] },
  { key: "silikatnaja", coords: [37.45, 55.50], label: "Silikatnaja", laneIds: ["KR-VLADIVOSTOK-SILIKATNAJA"] },
  { key: "moscow", coords: [37.62, 55.75], label: "Moscow", laneIds: ["KR-VLADIVOSTOK-MOSCOW"] },
  { key: "almaty",       coords: [76.90, 43.25],  label: "Almaty",       laneIds: ["KR-ALMATY", "CN-ALMATY"] },
  { key: "bishkek",      coords: [74.59, 42.87],  label: "Bishkek",      laneIds: ["KR-BISHKEK", "CN-BISHKEK"] },
  { key: "andijan",      coords: [72.34, 40.78],  label: "Andijan",      laneIds: ["KR-ANDIJAN", "CN-ANDIJAN"] },
  { key: "osh",          coords: [72.80, 40.53],  label: "Osh",          laneIds: ["KR-OSH", "CN-OSH"] },
  { key: "malaszewicze", coords: [23.69, 52.11],  label: "Małaszewicze", laneIds: ["KR-MALASZEWICZE"] },
]

// ── Types ──────────────────────────────────────────────────────────
type LaneWithDelay = LaneRow & { latestDelay: DelayWeeklyRow | null }

interface Props {
  lanesWithDelay: LaneWithDelay[]
  selectedLaneId: string | null
  onLaneSelect: (id: string) => void
}

// ── Legend item ────────────────────────────────────────────────────
function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1 text-[10px] text-slate-400">
      <span
        className="inline-block h-2 w-5 rounded-sm"
        style={{ background: color }}
      />
      {label}
    </span>
  )
}

// ── Main component ─────────────────────────────────────────────────
export function CorridorMapPanel({ lanesWithDelay, selectedLaneId, onLaneSelect }: Props) {
  const delayMap = new Map<string, number | null>(
    lanesWithDelay.map((l) => [l.id, l.latestDelay?.median_delay_d ?? null])
  )

  // Aggregate delay for a city: worst (max) among its feeding lanes
  function cityDelay(laneIds: string[]): number | null {
    const values = laneIds
      .map((id) => delayMap.get(id))
      .filter((v): v is number => v != null)
    if (values.length === 0) return null
    return Math.max(...values)
  }

  return (
    <div className="relative rounded-xl overflow-hidden" style={{ background: "#0f172a" }}>
      {/* Title overlay */}
      <div className="absolute top-3 left-4 z-10 flex items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
          유라시아 회랑 현황
        </span>
      </div>

      {/* Legend */}
      <div className="absolute bottom-3 left-4 z-10 flex items-center gap-3 rounded-md bg-slate-900/80 px-3 py-1.5 backdrop-blur-sm">
        <LegendDot color="#10b981" label="정시" />
        <LegendDot color="#f59e0b" label="1–3일" />
        <LegendDot color="#f97316" label="3–7일" />
        <LegendDot color="#ef4444" label="7일+" />
        <LegendDot color="#475569" label="데이터 없음" />
      </div>

      <ComposableMap
        projection="geoMercator"
        projectionConfig={{ center: [72, 47], scale: 320 }}
        width={980}
        height={460}
        style={{ width: "100%", height: "auto", display: "block" }}
      >
        {/* Country fills */}
        <Geographies geography={GEO_URL}>
          {({ geographies }) =>
            geographies.map((geo) => (
              <Geography
                key={geo.rsmKey}
                geography={geo}
                fill="#1e293b"
                stroke="#334155"
                strokeWidth={0.4}
                style={{ default: { outline: "none" }, hover: { outline: "none" }, pressed: { outline: "none" } }}
              />
            ))
          }
        </Geographies>

        {/* Corridor route lines */}
        {CORRIDORS.map((corridor) => {
          const delay = delayMap.get(corridor.id)
          const color  = delayColor(delay)
          const isSelected = selectedLaneId === corridor.id
          return (
            <Line
              key={corridor.id}
              coordinates={corridor.coords}
              stroke={color}
              strokeWidth={isSelected ? 3.5 : 2}
              strokeOpacity={delay == null ? 0.35 : isSelected ? 1 : 0.7}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="transparent"
              style={{ cursor: "pointer" }}
              onClick={() => onLaneSelect(corridor.id)}
            />
          )
        })}

        {/* Origin nodes */}
        {ORIGIN_NODES.map((n) => (
          <Marker key={n.label} coordinates={n.coords}>
            <circle r={5} fill="#38bdf8" stroke="#0f172a" strokeWidth={1.5} />
            <text
              textAnchor="middle"
              y={-9}
              style={{ fontSize: 8, fill: "#94a3b8", fontFamily: "system-ui" }}
            >
              {n.label}
            </text>
          </Marker>
        ))}

        {/* Transit nodes (small dots) */}
        {TRANSIT_NODES.map((n) => (
          <Marker key={n.label} coordinates={n.coords}>
            <circle r={3} fill="#475569" stroke="#0f172a" strokeWidth={1} />
            <text
              textAnchor="middle"
              y={-7}
              style={{ fontSize: 7, fill: "#64748b", fontFamily: "system-ui" }}
            >
              {n.label}
            </text>
          </Marker>
        ))}

        {/* Destination city badges — only show when data exists or lane is selected */}
        {DEST_CITIES.map((city) => {
          const delay    = cityDelay(city.laneIds)
          const color    = delayColor(delay)
          const label    = delayLabel(delay)
          const hasData  = delay != null
          const isActive = city.laneIds.some((id) => id === selectedLaneId)

          // Show a minimal dot for cities with no data (unless selected)
          if (!hasData && !isActive) {
            return (
              <Marker key={city.key} coordinates={city.coords}>
                <circle r={4} fill="#334155" stroke="#475569" strokeWidth={1} />
              </Marker>
            )
          }

          return (
            <Marker
              key={city.key}
              coordinates={city.coords}
              onClick={() => {
                const activeLane = city.laneIds.find(
                  (id) => delayMap.get(id) != null
                ) ?? city.laneIds[0]
                if (activeLane) onLaneSelect(activeLane)
              }}
            >
              {/* Glow ring for selected/active */}
              {isActive && (
                <circle
                  r={16}
                  fill={color}
                  fillOpacity={0.15}
                  stroke={color}
                  strokeWidth={1}
                  strokeOpacity={0.4}
                />
              )}
              {/* Main badge circle */}
              <circle
                r={10}
                fill={hasData ? color : "#1e293b"}
                stroke={hasData ? color : "#475569"}
                strokeWidth={1.5}
                fillOpacity={0.9}
                style={{ cursor: "pointer" }}
              />
              {/* Delay value */}
              <text
                textAnchor="middle"
                dominantBaseline="middle"
                style={{
                  fontSize: 7,
                  fontWeight: "bold",
                  fill: "#fff",
                  fontFamily: "system-ui",
                  pointerEvents: "none",
                }}
              >
                {label}
              </text>
              {/* City label — only shown for selected or sparse-area cities */}
              {(isActive || city.key === "malaszewicze") && (
                <text
                  textAnchor="middle"
                  y={19}
                  style={{
                    fontSize: 8,
                    fill: "#94a3b8",
                    fontFamily: "system-ui",
                    pointerEvents: "none",
                  }}
                >
                  {city.label}
                </text>
              )}
            </Marker>
          )
        })}
      </ComposableMap>
    </div>
  )
}

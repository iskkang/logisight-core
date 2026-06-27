// 유라시아 ERAI 차트 포털 블록 — index1520 스냅샷(eurasia_charts) 렌더. 다크 토큰(navy/teal), ERAI 빨강 브랜딩 미사용.
// 모든 블록 하단 출처표기(ERAI · index1520) 필수.
import { useMemo, useState } from "react";
import type { ReactNode } from "react";

import type { IndexQuotes, ChartDataset, GeoPayload } from "@/lib/api/eurasia-charts";

const WRAP = "mx-auto w-full max-w-[1240px] px-4 min-[640px]:px-7";
const CARD = "rounded-[12px] border border-[#78a0cd1c] bg-[#0a0f1d] p-4 min-[640px]:p-5";
// 자체 팔레트(ERAI 색 미사용).
const LINE_COLORS = ["#2dd4bf", "#0070C0", "#d97706", "#7c3aed", "#dc2626", "#16a34a"];
const INDEX_URL = "https://index1520.com/en/index/";
const STATS_URL = "https://index1520.com/en/statistics/";

function Attribution({ url }: { url: string }) {
  return (
    <div className="mt-2.5 text-[11px] text-[#5d6b80]">
      Source: ERAI (Eurasian Rail Alliance Index) ·{" "}
      <a href={url} target="_blank" rel="noopener noreferrer" className="text-[#828d9d] underline hover:text-[#2dd4bf]">
        index1520.com
      </a>
    </div>
  );
}

function pct(cur: number | null | undefined, base: number | null | undefined): number | null {
  if (cur == null || base == null || !base) return null;
  return ((cur - base) / base) * 100;
}
function fmtPct(v: number | null) {
  if (v == null || Number.isNaN(v)) return "—";
  return `${v > 0 ? "+" : ""}${v.toFixed(1)}%`;
}
const chgColor = (v: number | null) => (v == null ? "text-[#5d6b80]" : v >= 0 ? "text-[#16a34a]" : "text-[#dc2626]");

// 다중 라인 SVG 차트.
function LineChartSVG({
  labels,
  series,
  yFmt,
}: {
  labels: string[];
  series: { label: string; data: (number | null)[]; color: string }[];
  yFmt?: (v: number) => string;
}) {
  const W = 760, H = 280, pL = 48, pR = 14, pT = 14, pB = 26, ix = W - pL - pR, iy = H - pT - pB;
  const vals = series.flatMap((s) => s.data).filter((v): v is number => typeof v === "number");
  if (vals.length < 2 || labels.length < 2 || series.length === 0) {
    return <div className="grid min-h-[200px] place-items-center text-[13px] text-[#5d6b80]">표시할 시계열이 없습니다.</div>;
  }
  const lo = Math.min(...vals), hi = Math.max(...vals), pad = (hi - lo) * 0.1 || 1;
  const yMin = Math.max(0, lo - pad), yMax = hi + pad, n = labels.length;
  const X = (i: number) => pL + (i / (n - 1)) * ix;
  const Y = (v: number) => pT + (1 - (v - yMin) / (yMax - yMin)) * iy;
  const gx = Array.from({ length: 4 }, (_, i) => yMin + ((yMax - yMin) / 3) * i);
  const ticks = Array.from(new Set([0, Math.round(n / 4), Math.round(n / 2), Math.round((3 * n) / 4), n - 1])).filter((i) => i >= 0 && i < n);
  const fmt = yFmt ?? ((v: number) => Math.round(v).toLocaleString());
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full">
      {gx.map((g) => (
        <g key={g}>
          <line x1={pL} y1={Y(g)} x2={W - pR} y2={Y(g)} stroke="#1c2740" strokeWidth="1" />
          <text x={pL - 7} y={Y(g) + 3} textAnchor="end" fontSize="10" fill="#5d6b80">{fmt(g)}</text>
        </g>
      ))}
      {series.map((s) => {
        const seq = s.data.map((v, i) => ({ i, v })).filter((p): p is { i: number; v: number } => typeof p.v === "number");
        if (seq.length < 2) return null;
        const last = seq[seq.length - 1];
        return (
          <g key={s.label}>
            <polyline points={seq.map((p) => `${X(p.i).toFixed(1)},${Y(p.v).toFixed(1)}`).join(" ")} fill="none" stroke={s.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx={X(last.i).toFixed(1)} cy={Y(last.v).toFixed(1)} r="3" fill={s.color} />
          </g>
        );
      })}
      {ticks.map((i) => (
        <text key={i} x={X(i).toFixed(1)} y={H - 8} textAnchor="middle" fontSize="9" fill="#5d6b80">{labels[i]}</text>
      ))}
    </svg>
  );
}

function Legend({ series, visible, onToggle }: { series: ChartDataset[]; visible: Record<string, boolean>; onToggle: (label: string) => void }) {
  return (
    <div className="mb-3 flex flex-wrap gap-1.5">
      {series.map((d, i) => {
        const on = visible[d.label];
        return (
          <button
            key={d.label}
            type="button"
            onClick={() => onToggle(d.label)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] transition-colors ${on ? "border-[#78a0cd33] bg-[#101a2e] text-[#e9eef7]" : "border-[#78a0cd1c] text-[#5d6b80]"}`}
          >
            <span className="h-[8px] w-[8px] rounded-full" style={{ background: on ? LINE_COLORS[i % LINE_COLORS.length] : "#3a465c" }} />
            {d.label}
          </button>
        );
      })}
    </div>
  );
}

function RangeScale({ scale, setScale, range, setRange }: { scale: "month" | "week"; setScale: (s: "month" | "week") => void; range: number; setRange: (r: number) => void }) {
  const Btn = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) => (
    <button type="button" onClick={onClick} className={`rounded-[7px] px-2.5 py-[5px] text-[12px] ${active ? "bg-[#13203a] font-semibold text-white ring-1 ring-[#2dd4bf]/40" : "text-[#93a1b7] hover:text-white"}`}>{children}</button>
  );
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex gap-[3px] rounded-[8px] border border-[#78a0cd1c] bg-[#0e1626] p-[3px]">
        <Btn active={scale === "month"} onClick={() => setScale("month")}>월</Btn>
        <Btn active={scale === "week"} onClick={() => setScale("week")}>주</Btn>
      </div>
      {scale === "month" && (
        <div className="inline-flex gap-[3px] rounded-[8px] border border-[#78a0cd1c] bg-[#0e1626] p-[3px]">
          {[[12, "1y"], [24, "2y"], [36, "3y"], [0, "All"]].map(([r, l]) => (
            <Btn key={l as string} active={range === r} onClick={() => setRange(r as number)}>{l}</Btn>
          ))}
        </div>
      )}
    </div>
  );
}

// 공통: 토글·기간 라인차트 섹션.
function ChartSectionBlock({
  title,
  section,
  defaultVisible,
  yFmt,
  sourceUrl,
}: {
  title: string;
  section: IndexQuotes["indexes"] | undefined;
  defaultVisible: (label: string) => boolean;
  yFmt?: (v: number) => string;
  sourceUrl: string;
}) {
  const [scale, setScale] = useState<"month" | "week">("month");
  const [range, setRange] = useState(24);
  const datasets = section?.datasets[scale] ?? [];
  const [visible, setVisible] = useState<Record<string, boolean>>(() => {
    const all = [...(section?.datasets.month ?? []), ...(section?.datasets.week ?? [])];
    const v: Record<string, boolean> = {};
    for (const d of all) v[d.label] = defaultVisible(d.label);
    return v;
  });
  const onToggle = (label: string) => setVisible((p) => ({ ...p, [label]: !p[label] }));

  const labelsRaw = scale === "month" ? section?.labelsInfo.month.map((l) => l.lite) ?? section?.labels.month ?? [] : section?.labels.week ?? [];
  const cut = scale === "month" && range > 0 ? Math.max(0, labelsRaw.length - range) : 0;
  const labels = labelsRaw.slice(cut);
  const series = datasets
    .filter((d) => visible[d.label])
    .map((d, i) => ({ label: d.label, data: d.data.slice(cut), color: LINE_COLORS[datasets.indexOf(d) % LINE_COLORS.length] }));

  return (
    <section className={`${WRAP} pt-7`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2.5">
        <h2 className="text-[18px] font-extrabold tracking-[-0.02em] text-[#e9eef7]">{title}</h2>
        <RangeScale scale={scale} setScale={setScale} range={range} setRange={setRange} />
      </div>
      <div className={CARD}>
        <Legend series={datasets} visible={visible} onToggle={onToggle} />
        <LineChartSVG labels={labels} series={series} yFmt={yFmt} />
        <Attribution url={sourceUrl} />
      </div>
    </section>
  );
}

export function EurasiaIndexChart({ quotes }: { quotes: IndexQuotes | null }) {
  return (
    <ChartSectionBlock
      title="ERAI 지수 추이"
      section={quotes?.indexes}
      defaultVisible={(label) => label.startsWith("ERAI")}
      sourceUrl={INDEX_URL}
    />
  );
}

export function EurasiaTransitChart({ quotes }: { quotes: IndexQuotes | null }) {
  return (
    <ChartSectionBlock
      title="평균 운송기간 (일)"
      section={quotes?.times}
      defaultVisible={() => true}
      yFmt={(v) => v.toFixed(1)}
      sourceUrl={INDEX_URL}
    />
  );
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null;
  const w = 96, h = 26, min = Math.min(...data), max = Math.max(...data), rng = max - min || 1;
  const pts = data.map((v, i) => `${((i / (data.length - 1)) * w).toFixed(1)},${(h - ((v - min) / rng) * (h - 4) - 2).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-[24px] w-[96px]">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function EurasiaMarketMap({ quotes }: { quotes: IndexQuotes | null }) {
  const rows = useMemo(() => {
    const sec = quotes?.indexes;
    const ds = sec?.datasets.month ?? [];
    const info = sec?.labelsInfo.month ?? [];
    const latestYear = info.at(-1)?.year;
    const ytdIdx = latestYear ? info.findIndex((x) => x.year === latestYear) : -1;
    return ds.map((d, i) => {
      const a = d.data;
      const L = a.length;
      const cur = a[L - 1];
      const spark = a.slice(-12).filter((v): v is number => typeof v === "number");
      return {
        label: d.label,
        color: LINE_COLORS[i % LINE_COLORS.length],
        cur,
        mom: pct(cur, a[L - 2]),
        m3: pct(cur, a[L - 4]),
        ytd: ytdIdx >= 0 ? pct(cur, a[ytdIdx]) : null,
        y3: pct(cur, a[L - 37]),
        spark,
      };
    });
  }, [quotes]);

  return (
    <section className={`${WRAP} pt-7`}>
      <div className="mb-3 flex items-center justify-between gap-2.5">
        <h2 className="text-[18px] font-extrabold tracking-[-0.02em] text-[#e9eef7]">마켓맵 · 지수 변화율</h2>
      </div>
      <div className={`${CARD} overflow-x-auto`}>
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              {["지수", "최신", "추이", "MoM", "3개월", "연초대비", "3년"].map((h, i) => (
                <th key={h} className={`border-b border-[#78a0cd1c] px-3 pb-2.5 text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#5d6b80] ${i >= 3 ? "text-right" : "text-left"}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <td className="border-b border-[#78a0cd14] px-3 py-3">
                  <span className="inline-flex items-center gap-2 font-semibold text-[#e9eef7]">
                    <span className="h-[8px] w-[8px] rounded-full" style={{ background: r.color }} />{r.label}
                  </span>
                </td>
                <td className="border-b border-[#78a0cd14] px-3 py-3 text-right text-[#e9eef7]">{r.cur == null ? "—" : Math.round(r.cur).toLocaleString()}</td>
                <td className="border-b border-[#78a0cd14] px-3 py-3"><Sparkline data={r.spark} color={r.color} /></td>
                <td className={`border-b border-[#78a0cd14] px-3 py-3 text-right font-semibold ${chgColor(r.mom)}`}>{fmtPct(r.mom)}</td>
                <td className={`border-b border-[#78a0cd14] px-3 py-3 text-right ${chgColor(r.m3)}`}>{fmtPct(r.m3)}</td>
                <td className={`border-b border-[#78a0cd14] px-3 py-3 text-right ${chgColor(r.ytd)}`}>{fmtPct(r.ytd)}</td>
                <td className={`border-b border-[#78a0cd14] px-3 py-3 text-right ${chgColor(r.y3)}`}>{fmtPct(r.y3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <Attribution url={INDEX_URL} />
      </div>
    </section>
  );
}

function GeoColumn({ title, items }: { title: string; items: GeoPayload["data"] }) {
  const max = Math.max(1, ...items.map((x) => Number(x.TEU) || 0));
  return (
    <div className={CARD}>
      <div className="mb-2.5 text-[13px] font-bold text-[#e9eef7]">{title}</div>
      <div className="space-y-2">
        {items.map((x) => {
          const teu = Number(x.TEU) || 0;
          const up = (x.relativeTEU ?? 0) >= 0;
          return (
            <div key={x.id} className="text-[12px]">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-[#cdd6e4]">{x.rank}. {x.name}</span>
                <span className="flex items-center gap-2">
                  <span className="lsg-mono text-[#e9eef7]">{teu.toLocaleString()}</span>
                  <span className={`lsg-mono ${up ? "text-[#16a34a]" : "text-[#dc2626]"}`}>{fmtPct(x.relativeTEU)}</span>
                </span>
              </div>
              <div className="h-[5px] w-full overflow-hidden rounded-full bg-[#101a2e]">
                <span className="block h-full rounded-full bg-gradient-to-r from-[#0d9488] to-[#2dd4bf]" style={{ width: `${(teu / max) * 100}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function EurasiaGeoRanking({ geo }: { geo: GeoPayload | null }) {
  if (!geo || !geo.data?.length) return null;
  const cn = geo.data.filter((x) => x.countrySet === "cn").sort((a, b) => Number(b.TEU) - Number(a.TEU)).slice(0, 10);
  const eu = geo.data.filter((x) => x.countrySet === "eu").sort((a, b) => Number(b.TEU) - Number(a.TEU)).slice(0, 10);
  return (
    <section className={`${WRAP} pt-7`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2.5">
        <h2 className="text-[18px] font-extrabold tracking-[-0.02em] text-[#e9eef7]">지역별 물동량 (TEU)</h2>
        <span className="rounded-full border border-[#78a0cd1c] bg-[#0e1626] px-2.5 py-1 text-[11px] text-[#93a1b7]">
          {geo.interval?.minDate?.slice(0, 7)} ~ {geo.interval?.maxDate?.slice(0, 7)}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3 min-[900px]:grid-cols-2">
        <GeoColumn title="중국 (성별)" items={cn} />
        <GeoColumn title="유럽 (국가별)" items={eu} />
      </div>
      <Attribution url={STATS_URL} />
    </section>
  );
}

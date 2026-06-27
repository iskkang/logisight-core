// 유라시아 ERAI 차트 블록 — 라이트 sheet(기존 LogisightEurasia 디자인) 안에 들어가는 라이트 테마.
// index1520 스냅샷(eurasia_charts) 렌더. 모든 블록 하단 출처표기 필수. ERAI 빨강 미사용(자체 팔레트).
import { useMemo, useState } from "react";
import type { ReactNode } from "react";

import type { IndexQuotes, ChartDataset, GeoPayload } from "@/lib/api/eurasia-charts";

const CARD = "rounded-[14px] border border-[#d8dfe9] bg-[#f4f7fb] shadow-[0_1px_2px_rgba(16,24,40,0.04)]";
const CHIP = "rounded-full border border-[#d8dfe9] bg-[#eef1f6] px-[9px] py-[3px] text-[11px] text-[#828d9d]";
const LINE_COLORS = ["#0d9488", "#1864ab", "#d97706", "#7c3aed", "#dc2626", "#0891b2"];
const INDEX_URL = "https://index1520.com/en/index/";
const STATS_URL = "https://index1520.com/en/statistics/";

function Attribution({ url }: { url: string }) {
  return (
    <div className="mt-2.5 text-[11px] text-[#828d9d]">
      Source: ERAI (Eurasian Rail Alliance Index) ·{" "}
      <a href={url} target="_blank" rel="noopener noreferrer" className="text-[#54606f] underline hover:text-[#0d9488]">
        index1520.com
      </a>
    </div>
  );
}
function SectHead({ title, chip, right }: { title: string; chip?: string; right?: ReactNode }) {
  return (
    <div className="mb-3 mt-[26px] flex flex-wrap items-center justify-between gap-2.5">
      <div className="flex items-center gap-2.5">
        <h2 className="text-[19px] font-extrabold tracking-[-0.02em] text-[#1a2433]">{title}</h2>
        {chip && <span className={CHIP}>{chip}</span>}
      </div>
      {right}
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
const chgColor = (v: number | null) => (v == null ? "text-[#828d9d]" : v >= 0 ? "text-[#16a34a]" : "text-[#dc2626]");

function LineChartSVG({ labels, series, yFmt }: { labels: string[]; series: { label: string; data: (number | null)[]; color: string }[]; yFmt?: (v: number) => string }) {
  const W = 760, H = 280, pL = 48, pR = 14, pT = 14, pB = 26, ix = W - pL - pR, iy = H - pT - pB;
  const vals = series.flatMap((s) => s.data).filter((v): v is number => typeof v === "number");
  if (vals.length < 2 || labels.length < 2 || series.length === 0) {
    return <div className="grid min-h-[200px] place-items-center text-[13px] text-[#828d9d]">표시할 시계열이 없습니다.</div>;
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
          <line x1={pL} y1={Y(g)} x2={W - pR} y2={Y(g)} stroke="#e6ebf2" strokeWidth="1" />
          <text x={pL - 7} y={Y(g) + 3} textAnchor="end" fontSize="10" fill="#828d9d">{fmt(g)}</text>
        </g>
      ))}
      {series.map((s) => {
        const seq = s.data.map((v, i) => ({ i, v })).filter((p): p is { i: number; v: number } => typeof p.v === "number");
        if (seq.length < 2) return null;
        const last = seq[seq.length - 1];
        return (
          <g key={s.label}>
            <polyline points={seq.map((p) => `${X(p.i).toFixed(1)},${Y(p.v).toFixed(1)}`).join(" ")} fill="none" stroke={s.color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx={X(last.i).toFixed(1)} cy={Y(last.v).toFixed(1)} r="3.2" fill={s.color} />
          </g>
        );
      })}
      {ticks.map((i) => (
        <text key={i} x={X(i).toFixed(1)} y={H - 8} textAnchor="middle" fontSize="9" fill="#828d9d">{labels[i]}</text>
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
          <button key={d.label} type="button" onClick={() => onToggle(d.label)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] transition-colors ${on ? "border-[#cfe0d8] bg-white text-[#1a2433]" : "border-[#d8dfe9] bg-[#eef1f6] text-[#a0a9b6]"}`}>
            <span className="h-[8px] w-[8px] rounded-full" style={{ background: on ? LINE_COLORS[i % LINE_COLORS.length] : "#c3cbd6" }} />
            {d.label}
          </button>
        );
      })}
    </div>
  );
}
function RangeScale({ scale, setScale, range, setRange }: { scale: "month" | "week"; setScale: (s: "month" | "week") => void; range: number; setRange: (r: number) => void }) {
  const Btn = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) => (
    <button type="button" onClick={onClick} className={`rounded-[7px] px-2.5 py-[5px] text-[12px] ${active ? "bg-white font-semibold text-[#0d9488] shadow-[0_1px_2px_rgba(16,24,40,0.08)]" : "text-[#54606f]"}`}>{children}</button>
  );
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex gap-[3px] rounded-[8px] border border-[#d8dfe9] bg-[#e7ecf3] p-[3px]">
        <Btn active={scale === "month"} onClick={() => setScale("month")}>월</Btn>
        <Btn active={scale === "week"} onClick={() => setScale("week")}>주</Btn>
      </div>
      {scale === "month" && (
        <div className="inline-flex gap-[3px] rounded-[8px] border border-[#d8dfe9] bg-[#e7ecf3] p-[3px]">
          {[[12, "1y"], [24, "2y"], [36, "3y"], [0, "All"]].map(([r, l]) => (
            <Btn key={l as string} active={range === r} onClick={() => setRange(r as number)}>{l}</Btn>
          ))}
        </div>
      )}
    </div>
  );
}

function ChartSectionBlock({ title, section, defaultVisible, yFmt, sourceUrl }: {
  title: string; section: IndexQuotes["indexes"] | undefined;
  defaultVisible: (label: string) => boolean; yFmt?: (v: number) => string; sourceUrl: string;
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
  const series = datasets.filter((d) => visible[d.label]).map((d) => ({ label: d.label, data: d.data.slice(cut), color: LINE_COLORS[datasets.indexOf(d) % LINE_COLORS.length] }));

  return (
    <section>
      <SectHead title={title} right={<RangeScale scale={scale} setScale={setScale} range={range} setRange={setRange} />} />
      <div className={`${CARD} p-4 min-[640px]:p-5`}>
        <Legend series={datasets} visible={visible} onToggle={onToggle} />
        <LineChartSVG labels={labels} series={series} yFmt={yFmt} />
        <Attribution url={sourceUrl} />
      </div>
    </section>
  );
}

export function EurasiaIndexChart({ quotes }: { quotes: IndexQuotes | null }) {
  return <ChartSectionBlock title="ERAI 지수 추이" section={quotes?.indexes} defaultVisible={(l) => l.startsWith("ERAI")} sourceUrl={INDEX_URL} />;
}
export function EurasiaTransitChart({ quotes }: { quotes: IndexQuotes | null }) {
  return <ChartSectionBlock title="평균 운송기간 (일)" section={quotes?.times} defaultVisible={() => true} yFmt={(v) => v.toFixed(1)} sourceUrl={INDEX_URL} />;
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
      const a = d.data, L = a.length, cur = a[L - 1];
      return {
        label: d.label, color: LINE_COLORS[i % LINE_COLORS.length], cur,
        mom: pct(cur, a[L - 2]), m3: pct(cur, a[L - 4]),
        ytd: ytdIdx >= 0 ? pct(cur, a[ytdIdx]) : null, y3: pct(cur, a[L - 37]),
        spark: a.slice(-12).filter((v): v is number => typeof v === "number"),
      };
    });
  }, [quotes]);

  return (
    <section>
      <SectHead title="마켓맵 · 지수 변화율" />
      <div className={`${CARD} overflow-x-auto p-4 min-[640px]:p-5`}>
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              {["지수", "최신", "추이", "MoM", "3개월", "연초대비", "3년"].map((h, i) => (
                <th key={h} className={`border-b border-[#d8dfe9] px-3 pb-2.5 text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#828d9d] ${i >= 3 ? "text-right" : "text-left"}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <td className="border-b border-[#e6ebf2] px-3 py-3"><span className="inline-flex items-center gap-2 font-semibold text-[#1a2433]"><span className="h-[8px] w-[8px] rounded-full" style={{ background: r.color }} />{r.label}</span></td>
                <td className="border-b border-[#e6ebf2] px-3 py-3 text-right text-[#1a2433]">{r.cur == null ? "—" : Math.round(r.cur).toLocaleString()}</td>
                <td className="border-b border-[#e6ebf2] px-3 py-3"><Sparkline data={r.spark} color={r.color} /></td>
                <td className={`border-b border-[#e6ebf2] px-3 py-3 text-right font-semibold ${chgColor(r.mom)}`}>{fmtPct(r.mom)}</td>
                <td className={`border-b border-[#e6ebf2] px-3 py-3 text-right ${chgColor(r.m3)}`}>{fmtPct(r.m3)}</td>
                <td className={`border-b border-[#e6ebf2] px-3 py-3 text-right ${chgColor(r.ytd)}`}>{fmtPct(r.ytd)}</td>
                <td className={`border-b border-[#e6ebf2] px-3 py-3 text-right ${chgColor(r.y3)}`}>{fmtPct(r.y3)}</td>
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
    <div className={`${CARD} p-4 min-[640px]:p-5`}>
      <div className="mb-2.5 text-[13px] font-bold text-[#1a2433]">{title}</div>
      <div className="space-y-2">
        {items.map((x) => {
          const teu = Number(x.TEU) || 0, up = (x.relativeTEU ?? 0) >= 0;
          return (
            <div key={x.id} className="text-[12px]">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-[#54606f]">{x.rank}. {x.name}</span>
                <span className="flex items-center gap-2">
                  <span className="text-[#1a2433]">{teu.toLocaleString()}</span>
                  <span className={up ? "text-[#16a34a]" : "text-[#dc2626]"}>{fmtPct(x.relativeTEU)}</span>
                </span>
              </div>
              <div className="h-[5px] w-full overflow-hidden rounded-full bg-[#e6ebf2]">
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
    <section>
      <SectHead title="지역별 물동량 (TEU)" chip={`${geo.interval?.minDate?.slice(0, 7)} ~ ${geo.interval?.maxDate?.slice(0, 7)}`} />
      <div className="grid grid-cols-1 gap-3 min-[900px]:grid-cols-2">
        <GeoColumn title="중국 (성별)" items={cn} />
        <GeoColumn title="유럽 (국가별)" items={eu} />
      </div>
      <Attribution url={STATS_URL} />
    </section>
  );
}

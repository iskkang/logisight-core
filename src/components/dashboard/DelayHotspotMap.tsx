// 지연 혼잡 지도 (Eurasia Delay Hotspot Overview)
// ─────────────────────────────────────────────────────────────────────────────
// 데이터 소스 (엄격):
//  • 주(primary) = 계산 지연 delay_index_weekly (calculated_from_tracking).
//    값 = 해당 milestone에서 관측된 "누적" 지연 중앙값(median_delay_d). 그 지점이 지연을
//    '유발'했다는 뜻이 아니다(이전 구간 누적일 수 있음) → UI는 "지연 관측" 표현 사용.
//  • 보조(overlay, 선택) = 수동 입력 이슈 eurasia_disruptions (manual_disruption). 토글로만 표시.
//    계산 지연과 절대 합산하지 않는다.
//  • baseline_days/actual_days/delay_rate는 공개 집계에 없으므로 표시하지 않는다(가짜 비율 금지).
//
// 라이브러리: react-simple-maps(정적 유라시아 개요). 실제 zoom/cluster/tile/geocoding 필요 시 Leaflet 이관.
// 라벨: 심각·상위3·선택·호버만 + 그리디 충돌 회피. 기본 강조 = 최다 지연 항목(worst).
import { useMemo, useState } from "react";
import { ComposableMap, Geographies, Geography, Marker } from "react-simple-maps";

import { SEVERITY_META, severityColor, type Severity } from "@/lib/congestion";
import type { CalcDelayRecord, CalcUnmapped } from "@/lib/delay-segments";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";
const SEV_ORDER: Severity[] = ["severe", "moderate", "warning"];
const W = 980;
const H = 560;

const SEG_LABEL: Record<string, string> = {
  port: "항만",
  border: "국경",
  hub: "허브",
  destination: "도착지",
  corridor: "구간",
};

export type ManualMarker = {
  id: string;
  name: string;
  lng: number;
  lat: number;
  delayDays: number;
  severity: Severity;
  affectedCount: number;
  relatedRoutes: string[];
  kind: "point" | "corridor";
};

type Props = {
  calculated: CalcDelayRecord[];
  calcUnmapped: CalcUnmapped[];
  manual: ManualMarker[];
};

type Fit = { center: [number, number]; scale: number };
function fitProjection(coords: [number, number][]): Fit {
  if (coords.length === 0) return { center: [78, 48], scale: 360 };
  const lngs = coords.map((c) => c[0]);
  const lats = coords.map((c) => c[1]);
  const center: [number, number] = [
    (Math.min(...lngs) + Math.max(...lngs)) / 2,
    (Math.min(...lats) + Math.max(...lats)) / 2,
  ];
  const spanLng = Math.max(Math.max(...lngs) - Math.min(...lngs), 8);
  const spanLat = Math.max(Math.max(...lats) - Math.min(...lats), 8);
  const rad = Math.PI / 180;
  return {
    center,
    scale: Math.max(150, Math.min((W * 0.8) / (spanLng * rad), (H * 0.8) / (spanLat * rad), 780)),
  };
}
function makeToScreen(fit: Fit) {
  const rad = Math.PI / 180;
  const myc = Math.log(Math.tan(Math.PI / 4 + (fit.center[1] * rad) / 2));
  return (lng: number, lat: number): [number, number] => {
    const my = Math.log(Math.tan(Math.PI / 4 + (lat * rad) / 2));
    return [W / 2 + fit.scale * (lng - fit.center[0]) * rad, H / 2 - fit.scale * (my - myc)];
  };
}
function estLabelWidth(text: string, severe: boolean): number {
  const fs = severe ? 11 : 9.5;
  let w = 0;
  for (const ch of text) w += /[가-힣一-鿿]/.test(ch) ? fs * 1.05 : ch === " " ? fs * 0.35 : fs * 0.58;
  return w;
}
function calcRadius(c: CalcDelayRecord): number {
  const base = c.severity === "severe" ? 10 : c.severity === "moderate" ? 8 : 6.5;
  return base + Math.min(c.sample_count ?? 0, 20) * 0.12;
}

export function DelayHotspotMap({ calculated, calcUnmapped, manual }: Props) {
  const [userSelectedId, setUserSelectedId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [showManual, setShowManual] = useState(false);

  const counts = useMemo(() => {
    const c: Record<Severity, number> = { severe: 0, moderate: 0, warning: 0, normal: 0 };
    for (const x of calculated) c[x.severity] += 1;
    for (const x of calcUnmapped) c[x.severity] += 1;
    return c;
  }, [calculated, calcUnmapped]);

  // 기본 강조 = 최다 지연 '신뢰' 항목(저신뢰 1-샘플 이상치는 1위로 오지 않음).
  const worst = calculated.find((c) => c.confident) ?? calculated[0] ?? null;
  const selectedId = userSelectedId ?? worst?.id ?? null;

  const fit = useMemo(() => {
    const pts: [number, number][] = [
      ...calculated.map((c) => [c.lng, c.lat] as [number, number]),
      ...(showManual ? manual.map((m) => [m.lng, m.lat] as [number, number]) : []),
    ];
    return fitProjection(pts);
  }, [calculated, manual, showManual]);

  // 자동 라벨 상위3 = 신뢰 항목만(저신뢰는 선택/호버 때만 라벨).
  const topIds = useMemo(
    () => new Set(calculated.filter((c) => c.confident).slice(0, 3).map((c) => c.id)),
    [calculated],
  );

  const labelSet = useMemo(() => {
    const toScreen = makeToScreen(fit);
    type Cand = { id: string; lng: number; lat: number; text: string; severe: boolean; prio: number; delay: number };
    const cand: Cand[] = [];
    const prioOf = (id: string, fb: number) => (id === selectedId ? 0 : id === hoverId ? 1 : fb);
    for (const c of calculated) {
      const severe = c.severity === "severe";
      // 자동 라벨은 신뢰 항목만(severe/top3). 저신뢰는 선택/호버 때만.
      const autoLabel = (severe && c.confident) || topIds.has(c.id);
      if (!(autoLabel || c.id === selectedId || c.id === hoverId)) continue;
      cand.push({ id: c.id, lng: c.lng, lat: c.lat, text: `${c.location_name} +${c.delay_days}일`, severe, prio: prioOf(c.id, severe ? 2 : 3), delay: c.delay_days });
    }
    if (showManual) {
      for (const m of manual) {
        if (m.id !== selectedId && m.id !== hoverId) continue;
        cand.push({ id: m.id, lng: m.lng, lat: m.lat, text: `${m.name} +${m.delayDays}일`, severe: false, prio: prioOf(m.id, 2), delay: m.delayDays });
      }
    }
    cand.sort((a, b) => a.prio - b.prio || b.delay - a.delay);
    const placed: { x0: number; y0: number; x1: number; y1: number }[] = [];
    const set = new Set<string>();
    for (const c of cand) {
      const [sx, sy] = toScreen(c.lng, c.lat);
      const w = estLabelWidth(c.text, c.severe);
      const box = { x0: sx + 8, y0: sy - 8, x1: sx + 8 + w, y1: sy + 8 };
      const forced = c.prio <= 1;
      const clash = placed.some((p) => box.x0 < p.x1 && box.x1 > p.x0 && box.y0 < p.y1 && box.y1 > p.y0);
      if (forced || !clash) {
        placed.push(box);
        set.add(c.id);
      }
    }
    return set;
  }, [calculated, manual, showManual, fit, topIds, selectedId, hoverId]);

  const activeCalc = calculated.find((c) => c.id === userSelectedId) ?? null;
  const activeManual = manual.find((m) => m.id === userSelectedId) ?? null;

  const nothing = calculated.length + calcUnmapped.length + manual.length === 0;
  if (nothing) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center">
        <p className="text-sm font-medium text-foreground">현재 표시할 계산 지연 데이터가 없습니다.</p>
        <p className="mt-1 text-xs text-muted-foreground">delay_index_weekly 집계가 들어오면 표시됩니다.</p>
      </div>
    );
  }

  const focus = (id: string) => setUserSelectedId((cur) => (cur === id ? null : id));
  const dim = userSelectedId != null;
  const op = (id: string) => (!dim || id === userSelectedId || id === hoverId ? 1 : 0.4);
  const hasPoints = calculated.length + (showManual ? manual.length : 0) > 0;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      {/* ── 지도 ── */}
      <div
        className="relative overflow-hidden rounded-xl border border-border"
        style={{ background: "var(--color-card)", height: "clamp(520px, 60vh, 640px)" }}
      >
        {!hasPoints ? (
          <div className="flex h-full items-center justify-center px-6 text-center">
            <p className="text-sm text-muted-foreground">
              좌표가 매핑된 계산 지연 위치가 없습니다.
              <br />
              우측 ‘좌표 확인 필요’ 목록을 확인하세요.
            </p>
          </div>
        ) : (
          <>
            <ComposableMap projection="geoMercator" projectionConfig={{ center: fit.center, scale: fit.scale }} width={W} height={H} style={{ width: "100%", height: "100%" }}>
              <Geographies geography={GEO_URL}>
                {({ geographies }) =>
                  geographies.map((geo) => (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill="var(--color-muted)"
                      stroke="var(--color-border)"
                      strokeWidth={0.4}
                      style={{ default: { outline: "none" }, hover: { outline: "none" }, pressed: { outline: "none" } }}
                    />
                  ))
                }
              </Geographies>

              {/* 수동 입력 이슈(overlay) — 점선 hollow 링, 계산 지연과 시각적으로 구분 */}
              {showManual &&
                manual.map((m) => {
                  const color = severityColor(m.severity);
                  const isActive = m.id === selectedId || m.id === hoverId;
                  const showLabel = labelSet.has(m.id);
                  return (
                    <Marker
                      key={m.id}
                      coordinates={[m.lng, m.lat]}
                      onClick={() => focus(m.id)}
                      onMouseEnter={() => setHoverId(m.id)}
                      onMouseLeave={() => setHoverId((h) => (h === m.id ? null : h))}
                      style={{ default: { cursor: "pointer" }, hover: { cursor: "pointer" } }}
                    >
                      <circle r={isActive ? 8 : 6.5} fill="none" stroke={color} strokeWidth={1.6} strokeDasharray="2.5 2" />
                      {showLabel && (
                        <text x={10} y={3.5} style={{ fontSize: 9, fill: "var(--color-ink-muted)", opacity: op(m.id), pointerEvents: "none" }}>
                          {m.name} +{m.delayDays}일 (수동)
                        </text>
                      )}
                      <title>{`수동 입력 이슈: ${m.name}\n관리자 입력 지연 영향: +${m.delayDays}일\nSource: manual_disruption`}</title>
                    </Marker>
                  );
                })}

              {/* 계산 지연(primary) — 채워진 마커. 국경은 다이아몬드, 나머지는 원. */}
              {calculated.map((c) => {
                const color = severityColor(c.severity);
                const lowConf = !c.confident; // 저신뢰: 작게·옅게·점선
                const r = lowConf ? Math.max(3.5, calcRadius(c) * 0.62) : calcRadius(c);
                const isActive = c.id === selectedId || c.id === hoverId;
                const isSevere = c.severity === "severe";
                const showLabel = labelSet.has(c.id);
                const isBorder = c.segment_type === "border";
                const fillOp = lowConf ? 0.4 : 0.92;
                const glow = (isSevere && c.confident) || isActive;
                return (
                  <Marker
                    key={c.id}
                    coordinates={[c.lng, c.lat]}
                    onClick={() => focus(c.id)}
                    onMouseEnter={() => setHoverId(c.id)}
                    onMouseLeave={() => setHoverId((x) => (x === c.id ? null : x))}
                    style={{ default: { cursor: "pointer" }, hover: { cursor: "pointer" } }}
                  >
                    {glow && (
                      isBorder ? (
                        <rect x={-(r + 6)} y={-(r + 6)} width={(r + 6) * 2} height={(r + 6) * 2} transform="rotate(45)" fill={color} fillOpacity={0.16} stroke={color} strokeOpacity={0.4} />
                      ) : (
                        <circle r={r + 7} fill={color} fillOpacity={0.16} stroke={color} strokeOpacity={0.4} />
                      )
                    )}
                    {isBorder ? (
                      <rect x={-r} y={-r} width={r * 2} height={r * 2} transform="rotate(45)" fill={color} fillOpacity={fillOp} stroke="var(--color-card)" strokeWidth={1.5} strokeDasharray={lowConf ? "2 1.5" : undefined} />
                    ) : (
                      <circle r={r} fill={color} fillOpacity={fillOp} stroke="var(--color-card)" strokeWidth={1.5} strokeDasharray={lowConf ? "2 1.5" : undefined} />
                    )}
                    {showLabel && (
                      <text x={r + 5} y={3.5} style={{ fontSize: isSevere && c.confident ? 11 : 9.5, fontWeight: isSevere && c.confident ? 700 : 600, fill: "var(--color-ink)", opacity: op(c.id) * (lowConf ? 0.7 : 1), pointerEvents: "none" }}>
                        {`${c.location_name} +${c.delay_days}일${lowConf ? " (저신뢰)" : ""}`}
                      </text>
                    )}
                    <title>{`${c.location_name} · ${SEG_LABEL[c.segment_type] ?? c.segment_type}\nmilestone: ${c.milestone}\n관측 누적 지연(중앙값): +${c.delay_days}일\n표본 ${c.sample_count ?? "—"} · 품질 ${c.data_quality ?? "—"}${lowConf ? " · 저신뢰" : ""}\nSource: calculated_from_tracking (주간 집계)`}</title>
                  </Marker>
                );
              })}
            </ComposableMap>

            {/* 범례 + 토글 */}
            <div className="pointer-events-none absolute bottom-2.5 left-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-border bg-card/85 px-2.5 py-1.5 backdrop-blur-sm">
              {SEV_ORDER.map((s) => (
                <span key={s} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <span className="h-2 w-2 rounded-full" style={{ background: SEVERITY_META[s].color }} />
                  {SEVERITY_META[s].label}
                </span>
              ))}
              <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <span className="h-2 w-2 rotate-45 bg-muted-foreground/70" /> 국경
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowManual((v) => !v)}
              className="absolute right-3 bottom-2.5 rounded-md border border-border bg-card/90 px-2.5 py-1 text-[10px] font-medium text-muted-foreground backdrop-blur-sm hover:text-foreground"
            >
              수동 입력 이슈 {showManual ? "숨기기" : `표시 (${manual.length})`}
            </button>
            <div className="pointer-events-none absolute left-3 top-3 max-w-[280px] rounded-md border border-border bg-card/85 px-2.5 py-1 text-[10px] text-muted-foreground backdrop-blur-sm">
              주간 집계 지연 지수 · milestone 관측 누적 지연 · <b className="font-semibold text-foreground">현재 운영 컨테이너 현황 아님</b>
            </div>

            {/* 팝업 */}
            {(activeCalc || activeManual) && (
              <div className="absolute right-3 top-3 w-[244px] rounded-lg border border-border bg-card/95 p-3 text-xs shadow-sm backdrop-blur-sm">
                <button type="button" onClick={() => setUserSelectedId(null)} className="absolute right-2 top-2 text-muted-foreground hover:text-foreground" aria-label="닫기">
                  ✕
                </button>
                {activeCalc && (
                  <>
                    <div className="pr-4 font-semibold text-foreground">{activeCalc.location_name}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      <span className="inline-block rounded bg-status-observe/15 px-1.5 py-0.5 text-[10px] font-medium text-status-observe">주간 집계 지연 지수</span>
                      {!activeCalc.confident && (
                        <span className="inline-block rounded bg-status-caution/15 px-1.5 py-0.5 text-[10px] font-medium text-status-caution">저신뢰 · 표본 부족</span>
                      )}
                    </div>
                    <div className="mt-2 space-y-1 text-muted-foreground">
                      <Field label="구분" value={SEG_LABEL[activeCalc.segment_type] ?? activeCalc.segment_type} />
                      <Field label="Milestone" value={activeCalc.milestone} />
                      <Field label="관측 누적 지연" value={`+${activeCalc.delay_days}일 · ${SEVERITY_META[activeCalc.severity].label}`} valueColor={severityColor(activeCalc.severity)} />
                      {activeCalc.otp_pct != null && <Field label="정시율" value={`${activeCalc.otp_pct}%`} />}
                      {activeCalc.sample_count != null && <Field label="샘플 수" value={`${activeCalc.sample_count}`} />}
                      {activeCalc.data_quality && <Field label="데이터 품질" value={activeCalc.data_quality} />}
                      {activeCalc.week_iso && <Field label="기준 주" value={activeCalc.week_iso} />}
                    </div>
                    <p className="mt-2 border-t border-border pt-2 text-[11px] text-muted-foreground">
                      이 값은 해당 milestone에서 <b className="font-semibold">관측된 누적 지연</b>입니다. 실제 지연 발생 원인은 이전 구간일 수 있습니다.
                    </p>
                    {!activeCalc.confident && (
                      <p className="mt-1 text-[10px] text-status-caution">
                        표본 {activeCalc.sample_count ?? 0}건 · {activeCalc.data_quality} — 신뢰도가 낮아 상위 랭킹·자동 라벨에서 제외됩니다.
                      </p>
                    )}
                    <p className="mt-1 text-[10px] text-muted-foreground/80">Source: calculated_from_tracking · 노선: {activeCalc.laneName}</p>
                  </>
                )}
                {activeManual && (
                  <>
                    <div className="pr-4 font-semibold text-foreground">{activeManual.name}</div>
                    <div className="mt-1 inline-block rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">수동 입력 이슈 · 관리자 입력</div>
                    <div className="mt-2 space-y-1 text-muted-foreground">
                      <Field label="입력 지연 영향" value={`+${activeManual.delayDays}일 · ${SEVERITY_META[activeManual.severity].label}`} valueColor={severityColor(activeManual.severity)} />
                      <Field label="영향 노선" value={`${activeManual.affectedCount}개`} />
                    </div>
                    <p className="mt-2 border-t border-border pt-2 text-[10px] text-muted-foreground">Source: manual_disruption (계산 지연과 합산하지 않음)</p>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── 우측 분류 패널 ── */}
      <aside className="flex flex-col gap-3">
        {worst && (
          <button type="button" onClick={() => focus(worst.id)} className="w-full rounded-xl border bg-card px-3.5 py-3 text-left transition-colors hover:bg-muted" style={{ borderColor: `${severityColor(worst.severity)}66` }}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">최다 지연 (주간 집계)</span>
              <span className="text-[10px] text-muted-foreground">지도에서 강조됨 →</span>
            </div>
            <div className="mt-1 flex items-baseline justify-between gap-2">
              <span className="min-w-0 truncate text-base font-bold text-foreground">{worst.location_name}</span>
              <span className="shrink-0 text-lg font-extrabold tabular-nums" style={{ color: severityColor(worst.severity) }}>+{worst.delay_days}일</span>
            </div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">
              {SEG_LABEL[worst.segment_type] ?? worst.segment_type} · {worst.milestone} · 표본 {worst.sample_count ?? "—"} · {worst.data_quality ?? "—"}
              {!worst.confident && <span className="text-status-caution"> · 저신뢰</span>}
            </div>
          </button>
        )}

        <Section title="지연 지수 요약 (주간 집계)">
          <div className="grid grid-cols-3 gap-2">
            {SEV_ORDER.map((s) => (
              <div key={s} className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2">
                <span className="flex items-center gap-2 text-xs text-foreground">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: SEVERITY_META[s].color }} aria-hidden />
                  {SEVERITY_META[s].label}
                </span>
                <span className="text-sm font-bold tabular-nums text-foreground">{counts[s]}</span>
              </div>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            delay_index_weekly 주간 집계 기준 · 표본&lt;3·indicative는 저신뢰로 강등 · 임계값은 임시 절대일(≥1/3/7일).
          </p>
        </Section>

        {calculated.length > 0 && (
          <Section title="지연 지수 (주간 집계)">
            <div className="space-y-1.5">
              {calculated.slice(0, 8).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => focus(c.id)}
                  onMouseEnter={() => setHoverId(c.id)}
                  onMouseLeave={() => setHoverId((h) => (h === c.id ? null : h))}
                  className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs transition-colors ${c.id === selectedId ? "border-foreground/30 bg-muted" : "border-border bg-card hover:bg-muted"} ${c.confident ? "" : "opacity-60"}`}
                >
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: severityColor(c.severity) }} aria-hidden />
                  <span className="min-w-0 flex-1 truncate">
                    <span className="text-foreground">{c.location_name}</span>
                    <span className="ml-1 text-[10px] text-muted-foreground">
                      {SEG_LABEL[c.segment_type] ?? c.segment_type} · 표본 {c.sample_count ?? "—"} · {c.data_quality ?? "—"}
                      {!c.confident && <span className="text-status-caution"> · 저신뢰</span>}
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums font-medium text-foreground">+{c.delay_days}일</span>
                </button>
              ))}
            </div>
          </Section>
        )}

        {calcUnmapped.length > 0 && (
          <Section title="좌표 확인 필요">
            <p className="mb-1.5 text-[11px] text-muted-foreground">milestone를 신뢰 가능한 위치로 매핑하지 못한 계산 지연입니다(좌표 미발명).</p>
            <ul className="space-y-1 rounded-lg border border-border bg-card p-2 text-[11px]">
              {calcUnmapped.map((u) => (
                <li key={u.id} className="flex items-center justify-between gap-2 px-1 py-0.5">
                  <span className="min-w-0">
                    <span className="text-foreground">{u.laneName}</span>
                    <span className="ml-1 text-muted-foreground">· {u.milestone}</span>
                  </span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">+{u.delay_days}일</span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {manual.length > 0 && (
          <Section title="수동 입력 이슈 (overlay)">
            <button type="button" onClick={() => setShowManual((v) => !v)} className="mb-1.5 w-full rounded-lg border border-border bg-card px-3 py-1.5 text-left text-[11px] text-muted-foreground hover:bg-muted">
              관리자 입력 이슈 {manual.length}건 · 지도 {showManual ? "표시 중 (숨기기)" : "숨김 (표시)"}
            </button>
            {showManual && (
              <ul className="space-y-1 rounded-lg border border-border bg-card p-2 text-[11px]">
                {manual.slice(0, 8).map((m) => (
                  <li key={m.id}>
                    <button type="button" onClick={() => focus(m.id)} onMouseEnter={() => setHoverId(m.id)} onMouseLeave={() => setHoverId((h) => (h === m.id ? null : h))} className="flex w-full items-center justify-between gap-2 px-1 py-0.5 text-left hover:text-foreground">
                      <span className="min-w-0 truncate text-foreground">{m.name}</span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">+{m.delayDays}일</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        )}
      </aside>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</div>
      {children}
    </div>
  );
}

function Field({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span>{label}</span>
      <span className="tabular-nums font-medium" style={valueColor ? { color: valueColor } : { color: "var(--color-foreground)" }}>
        {value}
      </span>
    </div>
  );
}

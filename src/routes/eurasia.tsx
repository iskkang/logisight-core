import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

import {
  eurasiaLanesQueryOptions,
  eurasiaDelaysQueryOptions,
  eurasiaDisruptionsQueryOptions,
  formatDate,
  laneOrigin,
  type LaneRow,
  type DelayWeeklyRow,
  type DisruptionRow,
} from "@/lib/api/eurasia";

export const Route = createFileRoute("/eurasia")({
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(eurasiaLanesQueryOptions());
    context.queryClient.ensureQueryData(eurasiaDelaysQueryOptions());
    context.queryClient.ensureQueryData(eurasiaDisruptionsQueryOptions());
  },
  head: () => ({
    meta: [
      { title: "유라시아 코리도어 인텔리전스 — Logisight" },
      {
        name: "description",
        content:
          "한·중–CIS·유럽을 잇는 유라시아 철도·복합운송 코리도어의 운영 범위, 정시율 실측 집계, 활성 차질 상황을 한 화면에서 확인하세요.",
      },
      { property: "og:title", content: "유라시아 코리도어 인텔리전스 — Logisight" },
      {
        property: "og:description",
        content:
          "MTL Link 운영 기준 노선과 실측 정시율, 활성 차질(disruption) 모니터링.",
      },
      { property: "og:url", content: "https://logisight-core.lovable.app/eurasia" },
    ],
    links: [{ rel: "canonical", href: "https://logisight-core.lovable.app/eurasia" }],
  }),
  component: EurasiaPage,
  errorComponent: () => (
    <div className="mx-auto max-w-7xl px-4 py-16 text-sm text-muted-foreground">
      데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
    </div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-7xl px-4 py-16 text-sm text-muted-foreground">
      페이지를 찾을 수 없습니다.
    </div>
  ),
});

const LINE_COLORS = [
  "#0F2D5A",
  "#1B4D8C",
  "#38BDF8",
  "#0EA5A4",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#10B981",
];

function EurasiaPage() {
  const { data: lanes } = useSuspenseQuery(eurasiaLanesQueryOptions());
  const { data: delays } = useSuspenseQuery(eurasiaDelaysQueryOptions());
  const { data: disruptions } = useSuspenseQuery(eurasiaDisruptionsQueryOptions());

  const activeDisruptions = useMemo(
    () => disruptions.filter((d) => d.resolved_at == null),
    [disruptions],
  );

  const activeByLane = useMemo(() => {
    const s = new Set<string>();
    for (const d of activeDisruptions) if (d.lane_id) s.add(d.lane_id);
    return s;
  }, [activeDisruptions]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 lg:px-6 lg:py-14">
      <Hero />
      <section className="mt-10">
        <LanesTable lanes={lanes} activeByLane={activeByLane} />
      </section>
      <section className="mt-12">
        <OnTimeChart delays={delays} lanes={lanes} />
      </section>
      <section className="mt-12">
        <ActiveDisruptions rows={activeDisruptions} lanes={lanes} />
      </section>
      <section className="mt-12">
        <CtaCard />
      </section>
      <p className="mt-8 text-xs text-muted-foreground">
        운송기간: MTL Link 운영 기준 · 정시율: 실측 집계
      </p>
    </main>
  );
}

function Hero() {
  return (
    <header className="border-b border-border pb-6">
      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-cyan)]">
        Eurasia Corridor
      </p>
      <h1 className="mt-2 text-3xl font-bold text-foreground lg:text-4xl">
        유라시아 코리도어 인텔리전스
      </h1>
      <p className="mt-3 max-w-3xl text-sm text-muted-foreground lg:text-base">
        한·중에서 CIS, 유럽까지 이어지는 철도·복합운송 회랑의 운영 범위, 실측 정시율,
        활성 차질 상황을 한 화면에서 점검하세요.
      </p>
    </header>
  );
}

function LanesTable({
  lanes,
  activeByLane,
}: {
  lanes: LaneRow[];
  activeByLane: Set<string>;
}) {
  return (
    <div>
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-xl font-semibold">주요 노선</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            출처: MTL Link 운영 기준 · 예상 운영 범위는 표본 평균이 아닌 운영상 권장 범위입니다.
          </p>
        </div>
      </div>

      {lanes.length === 0 ? (
        <p className="mt-6 rounded-md border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          수집 예정
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-medium">노선</th>
                <th className="px-4 py-3 text-left font-medium">출발지</th>
                <th className="px-4 py-3 text-left font-medium">경유</th>
                <th className="px-4 py-3 text-left font-medium">
                  예상 운영 범위
                </th>
                <th className="px-4 py-3 text-left font-medium">상태</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {lanes.map((l) => {
                const isDelay = activeByLane.has(l.id);
                const transit =
                  l.transit_min != null && l.transit_max != null
                    ? `${l.transit_min}~${l.transit_max}일`
                    : l.transit_min != null
                      ? `${l.transit_min}일~`
                      : "—";
                const borders = l.border_points?.length
                  ? l.border_points.join(" → ")
                  : "—";
                return (
                  <tr key={l.id} className="bg-card">
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">
                        {l.name_ko ?? l.name_en ?? l.id}
                        {l.is_featured ? (
                          <span className="ml-2 rounded-sm bg-[var(--color-cyan)]/15 px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-navy-900)]">
                            추천
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">{l.id}</div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {laneOrigin(l.id)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{borders}</td>
                    <td className="px-4 py-3 text-foreground">{transit}</td>
                    <td className="px-4 py-3">
                      <StatusBadge delayed={isDelay} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ delayed }: { delayed: boolean }) {
  if (delayed) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> 지연주의
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> 정상
    </span>
  );
}

type ChartPoint = { week_iso: string } & Record<string, number | string | null>;

function OnTimeChart({
  delays,
  lanes,
}: {
  delays: DelayWeeklyRow[];
  lanes: LaneRow[];
}) {
  const laneName = useMemo(() => {
    const m = new Map<string, string>();
    for (const l of lanes) m.set(l.id, l.name_ko ?? l.name_en ?? l.id);
    return m;
  }, [lanes]);

  const { laneIds, chartData, sampleSummary } = useMemo(() => {
    const byLane = new Map<string, DelayWeeklyRow[]>();
    for (const r of delays) {
      const arr = byLane.get(r.lane_id) ?? [];
      arr.push(r);
      byLane.set(r.lane_id, arr);
    }
    const ids = [...byLane.keys()].slice(0, 6);
    const weekSet = new Set<string>();
    for (const id of ids) {
      for (const r of byLane.get(id) ?? []) weekSet.add(r.week_iso);
    }
    const weeks = [...weekSet].sort();
    const dataMap = new Map<string, ChartPoint>();
    for (const w of weeks) dataMap.set(w, { week_iso: w });
    const samples: { id: string; total: number }[] = [];
    for (const id of ids) {
      let total = 0;
      for (const r of byLane.get(id) ?? []) {
        const v =
          r.on_time_rate != null
            ? r.on_time_rate
            : r.otp_pct != null
              ? r.otp_pct
              : null;
        if (v != null) {
          const point = dataMap.get(r.week_iso)!;
          // normalize to % (0-100). If looks like fraction, scale.
          point[id] = v <= 1 ? Math.round(v * 1000) / 10 : Math.round(v * 10) / 10;
        }
        total += r.sample_count ?? 0;
      }
      samples.push({ id, total });
    }
    return {
      laneIds: ids,
      chartData: weeks.map((w) => dataMap.get(w)!),
      sampleSummary: samples,
    };
  }, [delays]);

  return (
    <div>
      <h2 className="text-xl font-semibold">정시율 추이 (실측 집계)</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        주차별 실측 정시율(%). 표본 수가 적은 주차는 변동성이 클 수 있습니다.
      </p>

      {laneIds.length === 0 || chartData.length === 0 ? (
        <p className="mt-6 rounded-md border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          수집 예정
        </p>
      ) : (
        <>
          <div className="mt-4 h-80 w-full rounded-lg border border-border bg-card p-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="week_iso" fontSize={11} />
                <YAxis
                  fontSize={11}
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  formatter={(v: number) => `${v}%`}
                  labelFormatter={(l) => `주차 ${l}`}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {laneIds.map((id, i) => (
                  <Line
                    key={id}
                    type="monotone"
                    dataKey={id}
                    name={laneName.get(id) ?? id}
                    stroke={LINE_COLORS[i % LINE_COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {sampleSummary.map((s) => (
              <span key={s.id}>
                {laneName.get(s.id) ?? s.id}: 표본 {s.total.toLocaleString("ko-KR")}건
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ActiveDisruptions({
  rows,
  lanes,
}: {
  rows: DisruptionRow[];
  lanes: LaneRow[];
}) {
  const laneName = useMemo(() => {
    const m = new Map<string, string>();
    for (const l of lanes) m.set(l.id, l.name_ko ?? l.name_en ?? l.id);
    return m;
  }, [lanes]);

  return (
    <div>
      <h2 className="text-xl font-semibold">활성 차질</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        현재 미해결 상태인 차질(disruption) 보고만 표시합니다.
      </p>

      {rows.length === 0 ? (
        <p className="mt-6 rounded-md border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          현재 보고된 차질 없음
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
          {rows.map((d) => (
            <li key={d.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <SeverityBadge severity={d.severity} />
                  {d.category ? (
                    <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                      {d.category}
                    </span>
                  ) : null}
                  {d.lane_id ? (
                    <span className="text-xs text-muted-foreground">
                      {laneName.get(d.lane_id) ?? d.lane_id}
                    </span>
                  ) : null}
                </div>
                <h3 className="mt-1 break-keep text-sm font-medium text-foreground">
                  {d.title_ko ?? d.title_en ?? "(제목 미상)"}
                </h3>
                <div className="mt-1 text-xs text-muted-foreground">
                  발생일 {formatDate(d.event_date ?? d.started_at)}
                  {d.impact_days != null ? ` · 영향 ${d.impact_days}일` : ""}
                </div>
              </div>
              {d.source_url ? (
                <a
                  href={d.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 text-xs font-medium text-[var(--color-navy-600)] underline-offset-2 hover:underline"
                >
                  원문 →
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SeverityBadge({ severity }: { severity: string | null }) {
  const s = (severity ?? "medium").toLowerCase();
  const styles =
    s === "high" || s === "critical"
      ? "bg-red-100 text-red-800"
      : s === "low"
        ? "bg-slate-100 text-slate-700"
        : "bg-amber-100 text-amber-800";
  const label =
    s === "high"
      ? "높음"
      : s === "critical"
        ? "심각"
        : s === "low"
          ? "낮음"
          : "중간";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${styles}`}>
      {label}
    </span>
  );
}

function CtaCard() {
  return (
    <div
      className="overflow-hidden rounded-xl border border-border p-6 lg:p-8"
      style={{
        background:
          "linear-gradient(135deg, var(--color-navy-900) 0%, var(--color-navy-600) 100%)",
      }}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="text-white">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-cyan)]">
            MTL Link
          </p>
          <h3 className="mt-1 text-xl font-semibold lg:text-2xl">
            MTL 직계약 노선 문의
          </h3>
          <p className="mt-2 max-w-xl text-sm text-white/80">
            한·중–CIS·유럽 구간의 직계약 노선 운영 범위, 통관 절차, 화차 가용성을 안내해
            드립니다.
          </p>
        </div>
        <a
          href="mailto:contact@logisight.io?subject=MTL%20%EC%A7%81%EA%B3%84%EC%95%BD%20%EB%85%B8%EC%84%A0%20%EB%AC%B8%EC%9D%98"
          className="inline-flex items-center justify-center rounded-md bg-[var(--color-cyan)] px-5 py-2.5 text-sm font-semibold text-[var(--color-navy-900)] transition-opacity hover:opacity-90"
        >
          문의하기 →
        </a>
      </div>
    </div>
  );
}
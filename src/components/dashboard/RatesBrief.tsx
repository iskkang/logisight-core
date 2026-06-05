import type { ComputedSignal, SignalState } from "@/server/signals";

const STATE_META: Record<
  SignalState,
  { label: string; text: string; dot: string; chip: string }
> = {
  alert: {
    label: "경보",
    text: "text-status-alert",
    dot: "bg-status-alert",
    chip: "text-status-alert bg-status-alert/10",
  },
  caution: {
    label: "주의",
    text: "text-status-caution",
    dot: "bg-status-caution",
    chip: "text-status-caution bg-status-caution/10",
  },
  observe: {
    label: "관찰",
    text: "text-status-observe",
    dot: "bg-status-observe",
    chip: "text-status-observe bg-status-observe/10",
  },
  normal: {
    label: "정상",
    text: "text-status-normal",
    dot: "bg-status-normal",
    chip: "text-status-normal bg-status-normal/10",
  },
};

const ORDER: Record<SignalState, number> = { alert: 3, caution: 2, observe: 1, normal: 0 };

type Props = {
  signals: (ComputedSignal | null)[];
  asOf: string | null;
};

/**
 * 운임 인텔리전스 브리프 — 계산된 시그널을 종합한 헤드라인 패널.
 * 시그널의 basis/confidence/sources를 그대로 표시하며, 임의 수치·인과 단정 없음.
 */
export function RatesBrief({ signals, asOf }: Props) {
  const present = signals.filter((s): s is ComputedSignal => s !== null);

  if (present.length === 0) {
    return (
      <section className="rounded-lg border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground">운임 인텔리전스 브리프 — 데이터 수집 중</p>
      </section>
    );
  }

  const dominant = [...present].sort((a, b) => ORDER[b.state] - ORDER[a.state])[0];
  const counts = present.reduce<Record<SignalState, number>>(
    (acc, s) => {
      acc[s.state] += 1;
      return acc;
    },
    { alert: 0, caution: 0, observe: 0, normal: 0 },
  );
  const elevated = present.filter((s) => s.state !== "normal");
  const dm = STATE_META[dominant.state];

  return (
    <section className="rounded-lg border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`inline-block h-2.5 w-2.5 rounded-full ${dm.dot}`} />
          <h2 className="text-sm font-semibold">
            운임 인텔리전스 브리프 —{" "}
            <span className={dm.text}>
              {dominant.state === "normal" ? "시장 안정" : `${dominant.label} 우위`}
            </span>
          </h2>
        </div>
        <span className="text-[11px] text-muted-foreground">기준 {asOf ?? "—"}</span>
      </div>

      <p className="mt-2 text-sm leading-relaxed text-foreground">
        {dominant.state === "normal"
          ? "모든 운임 지표가 정상 범위에 있습니다."
          : `${dominant.label} — ${dm.label}. ${dominant.basis}`}
      </p>

      {/* posture counts */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {(["alert", "caution", "observe", "normal"] as const).map((st) =>
          counts[st] > 0 ? (
            <span
              key={st}
              className={`rounded px-2 py-0.5 text-[11px] font-medium ${STATE_META[st].chip}`}
            >
              {STATE_META[st].label} {counts[st]}건
            </span>
          ) : null,
        )}
      </div>

      {/* elevated observations */}
      {elevated.length > 0 && (
        <ul className="mt-3 space-y-1.5 border-t border-border pt-3">
          {elevated.map((s) => (
            <li key={s.label} className="flex items-start gap-2 text-xs">
              <span
                className={`mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full ${STATE_META[s.state].dot}`}
              />
              <span className="min-w-0">
                <span className="font-medium text-foreground">{s.label}</span>
                <span className="text-muted-foreground"> — {s.basis}</span>
                <span className="text-muted-foreground">
                  {" "}· 신뢰도 {s.confidence} · {s.sources.join("·")}
                  {s.asOf ? ` · ${s.asOf.slice(0, 10)}` : ""}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-3 text-[11px] text-muted-foreground">
        방법론: 상관·정합·추정 표현만 사용 · 선행/후행 판정 미표시 · 인과 단정 없음
      </p>
    </section>
  );
}

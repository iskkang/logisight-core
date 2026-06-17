import type { ComputedSignal, SignalState } from "@/server/signals";

const ORDER: Record<SignalState, number> = { alert: 3, caution: 2, observe: 1, normal: 0 };

const DOT: Record<SignalState, string> = {
  alert: "bg-status-alert",
  caution: "bg-status-caution",
  observe: "bg-status-observe",
  normal: "bg-status-normal",
};

type Props = {
  signals: (ComputedSignal | null)[];
  asOf: string | null;
  scope?: string;
  prose?: { headline: string; ocean: string; global: string; air: string; outlook: string } | null;
};

function formatAsOf(value: string | null | undefined): string {
  if (!value) return "—";
  const compact = value.replace(/\D/g, "");
  if (compact.length === 6) return `${compact.slice(0, 4)}-${compact.slice(4, 6)}`;
  if (compact.length >= 8)
    return `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`;
  return value;
}

/** Pull the signed percentage figures out of a signal's basis string. */
function pcts(basis: string): string[] {
  return basis.match(/[+-]?\d+(?:\.\d+)?%/g) ?? [];
}

/** Turn a computed signal into a plain-language sentence a shipper understands. */
function narrate(s: ComputedSignal): string {
  const nums = pcts(s.basis);
  const L = s.label;

  if (L.includes("해상 운임 압력")) {
    const p = nums[0] ?? "";
    if (s.state === "alert")
      return `한국발 해상 운임이 가파르게 오르며 최근 1년 중 최상위권(백분위 ${p})에 있습니다. 부킹 단가 부담이 큰 국면이라 계약·BAF 조건을 미리 점검할 시점입니다.`;
    if (s.state === "caution")
      return `한국발 해상 운임이 오름세를 이어가며 평년보다 높은 수준(백분위 ${p})입니다. 단가 상승에 유의하세요.`;
    if (s.state === "observe")
      return `한국발 해상 운임이 꿈틀대고 있습니다(백분위 ${p}). 추세가 굳어질지 지켜볼 구간입니다.`;
    return `한국발 해상 운임은 안정적인 범위에서 움직이고 있습니다.`;
  }

  if (L.includes("글로벌 운임 모멘텀")) {
    const scfi = nums[0] ?? "—";
    const wci = nums[1];
    const notAligned = s.basis.includes("비정합");
    const aligned = !notAligned && s.basis.includes("정합");
    const up = parseFloat(scfi) >= 0;
    if (wci && aligned)
      return `글로벌 컨테이너 운임(SCFI ${scfi})과 Drewry 운임(WCI ${wci})이 같은 방향으로 움직여 ${up ? "상승" : "하락"} 흐름이 뚜렷합니다.`;
    if (wci && notAligned)
      return `글로벌 두 지수가 서로 다른 방향(SCFI ${scfi}, WCI ${wci})을 가리켜 추세가 아직 불분명합니다 — 며칠 더 지켜볼 필요가 있습니다.`;
    return `글로벌 컨테이너 운임(SCFI)이 한 달 새 ${scfi} 움직였습니다.`;
  }

  if (L.includes("항공 운임")) {
    const x = nums[0] ?? "";
    const modal = s.basis.includes("모달");
    const route = L.replace("항공 운임 변동", "").replace(/[()]/g, "").trim() || "인천발";
    return `${route} 항공 운임이 한 달 새 ${x} 움직였습니다.${
      modal ? " 해상 운임이 높은 상황이라 일부 물량이 항공으로 옮겨갈 가능성도 함께 봅니다." : ""
    }`;
  }

  if (L.includes("벙커") || L.includes("연료")) {
    const x = nums[0] ?? "";
    return `연료비(VLSFO)가 ${x} 변동해 운임 부대비용에 영향을 줄 수 있습니다.`;
  }

  return s.basis;
}

function buildHeadline(dominant: ComputedSignal, allNormal: boolean): string {
  if (allNormal) return "이번 주 운임 시장은 대체로 안정적입니다.";
  const L = dominant.label;
  if (L.includes("해상 운임 압력")) return "이번 주는 한국발 해상 운임 상승이 가장 큰 이슈입니다.";
  if (L.includes("글로벌 운임 모멘텀")) return "이번 주는 글로벌 운임 흐름이 시장을 끌고 있습니다.";
  if (L.includes("항공")) return "이번 주는 항공 운임 변동이 눈에 띕니다.";
  if (L.includes("벙커") || L.includes("연료")) return "이번 주는 연료비 변동이 운임에 부담을 주고 있습니다.";
  return "이번 주 운임 시장에 주목할 변화가 있습니다.";
}

function buildOutlook(present: ComputedSignal[], elevated: ComputedSignal[]): string {
  if (elevated.length === 0) return "당분간 큰 변동 없이 안정세가 이어질 것으로 보입니다.";
  const global = present.find((s) => s.label.includes("글로벌 운임 모멘텀"));
  const aligned = !!global && !global.basis.includes("비정합") && global.basis.includes("정합");
  if (aligned)
    return "단기적으로 상승 압력이 이어질 가능성이 있어, 부킹·계약 타이밍을 앞당겨 검토할 만합니다.";
  if (global && global.basis.includes("비정합"))
    return "지표 방향이 엇갈리는 만큼, 며칠간 흐름을 더 확인한 뒤 의사결정을 권합니다.";
  return "변동이 큰 구간인 만큼 단가·부킹 조건을 자주 확인하시길 권합니다.";
}

/**
 * 운임 인텔리전스 브리프 — 계산된 시그널을 사람이 이해하는 분석·전망으로 풀어 보여준다.
 * 내용은 상관·추정 표현만 사용하고 인과 단정/선행·후행 판정을 하지 않는다(표시 문구 없이 준수).
 */
export function RatesBrief({ signals, asOf, scope, prose }: Props) {
  const present = signals.filter((s): s is ComputedSignal => s !== null);

  if (present.length === 0) {
    return (
      <section className="rounded-lg border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground">운임 인텔리전스 브리프 — 데이터 수집 중</p>
      </section>
    );
  }

  const dominant = [...present].sort((a, b) => ORDER[b.state] - ORDER[a.state])[0];
  const elevated = present.filter((s) => s.state !== "normal");
  const lines = elevated.length > 0 ? elevated : present;
  const head = buildHeadline(dominant, elevated.length === 0);
  const outlook = buildOutlook(present, elevated);
  const sources = Array.from(new Set(present.flatMap((s) => s.sources)));

  if (prose) {
    const items = [prose.ocean, prose.global, prose.air].filter((t) => t && t.trim());
    return (
      <section className="rounded-lg border border-border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${DOT[dominant.state]}`} />
            <h2 className="text-sm font-semibold">운임 인텔리전스 브리프</h2>
          </div>
          <span className="text-[11px] text-muted-foreground">기준 {formatAsOf(asOf)}</span>
        </div>
        <p className="mt-2.5 text-[15px] font-semibold leading-relaxed text-foreground">{prose.headline}</p>
        <ul className="mt-3 space-y-2">
          {items.map((t, i) => (
            <li key={i} className="flex items-start gap-2 text-sm leading-relaxed">
              <span className={`mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full ${DOT[dominant.state]}`} />
              <span className="text-foreground/90">{t}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 rounded-md bg-status-observe/10 px-3 py-2 text-sm leading-relaxed">
          <span className="font-medium text-status-observe">전망 · </span>
          <span className="text-foreground/90">{prose.outlook}</span>
        </div>
        {sources.length > 0 && <p className="mt-3 text-[11px] text-muted-foreground">출처 {sources.join("·")}</p>}
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`inline-block h-2.5 w-2.5 rounded-full ${DOT[dominant.state]}`} />
          <h2 className="text-sm font-semibold">운임 인텔리전스 브리프</h2>
        </div>
        <span className="text-[11px] text-muted-foreground">기준 {formatAsOf(asOf)}</span>
      </div>

      {scope && (
        <div className="mt-2 inline-flex rounded bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
          스코프 {scope}
        </div>
      )}

      <p className="mt-2.5 text-[15px] font-semibold leading-relaxed text-foreground">{head}</p>

      <ul className="mt-3 space-y-2">
        {lines.map((s) => (
          <li key={s.label} className="flex items-start gap-2 text-sm leading-relaxed">
            <span className={`mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full ${DOT[s.state]}`} />
            <span className="text-foreground/90">{narrate(s)}</span>
          </li>
        ))}
      </ul>

      <div className="mt-3 rounded-md bg-status-observe/10 px-3 py-2 text-sm leading-relaxed">
        <span className="font-medium text-status-observe">전망 · </span>
        <span className="text-foreground/90">{outlook}</span>
      </div>

      {sources.length > 0 && (
        <p className="mt-3 text-[11px] text-muted-foreground">출처 {sources.join("·")}</p>
      )}
    </section>
  );
}

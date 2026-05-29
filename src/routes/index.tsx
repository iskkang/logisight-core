import { createFileRoute } from "@tanstack/react-router";
import {
  useLatestFreightIndices,
  formatIndexValue,
} from "@/hooks/use-freight-indices";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Logisight — 물류를 읽는 새로운 시선" },
      {
        name: "description",
        content:
          "운임 지수와 시장 뉴스, 정책 변화. 흩어진 정보를 매주 한 편의 분석으로 정리합니다.",
      },
      { property: "og:title", content: "Logisight — 물류를 읽는 새로운 시선" },
      {
        property: "og:description",
        content: "운임 지수와 시장 뉴스, 정책 변화. 매주 한 편의 분석으로 정리합니다.",
      },
    ],
  }),
  component: Index,
});

function HeroCard({ code, sub }: { code: string; sub: string }) {
  const { data, isLoading } = useLatestFreightIndices();
  const row = data?.find((r) => r.index_code === code);
  const value = isLoading ? "…" : formatIndexValue(row?.value ?? null);
  const change = row?.change_pct;
  const changeLabel =
    change == null
      ? "수집 예정"
      : `${change >= 0 ? "+" : ""}${change.toFixed(2)}% WoW`;
  const changeColor =
    change == null
      ? "text-white/50"
      : change >= 0
        ? "text-emerald-300"
        : "text-rose-300";

  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-4 backdrop-blur">
      <div className="text-[11px] uppercase tracking-wide text-white/60">{code}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums text-white">{value}</div>
      <div className={`text-[11px] tabular-nums ${changeColor}`}>
        {sub} · {changeLabel}
      </div>
    </div>
  );
}

function Index() {
  return (
    <section
      className="relative overflow-hidden"
      style={{
        background:
          "linear-gradient(135deg, var(--color-navy-900) 0%, var(--color-navy-800) 100%)",
      }}
    >
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 lg:grid-cols-5 lg:gap-12 lg:px-6 lg:py-20">
        <div className="lg:col-span-3">
          <p
            className="text-xs font-semibold uppercase tracking-[0.18em]"
            style={{ color: "var(--color-cyan)" }}
          >
            Logistics Intelligence Platform
          </p>
          <h1 className="mt-4 text-balance text-3xl font-bold leading-tight text-white lg:text-5xl">
            물류를 읽는
            <br />
            <span style={{ color: "var(--color-cyan)" }}>새로운 시선</span>
          </h1>
          <p className="mt-5 max-w-xl text-sm leading-relaxed text-white/75 lg:text-base">
            운임 지수와 시장 뉴스, 정책 변화. 흩어진 정보를 매주 한 편의 분석으로 정리합니다.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a
              href="/news"
              className="inline-flex h-10 items-center rounded-md px-5 text-sm font-semibold"
              style={{
                background: "var(--color-cyan)",
                color: "var(--color-navy-900)",
              }}
            >
              이번 주 분석 보기
            </a>
            <a
              href="/rates"
              className="inline-flex h-10 items-center rounded-md border border-white/25 px-5 text-sm font-semibold text-white hover:bg-white/5"
            >
              운임 대시보드
            </a>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="grid grid-cols-2 gap-3">
            <HeroCard code="SCFI" sub="상하이→유럽 종합" />
            <HeroCard code="WCI" sub="드류리 종합" />
            <HeroCard code="KCCI" sub="한국형 종합" />
            <HeroCard code="CCFI" sub="중국 수출 종합" />
          </div>
        </div>
      </div>

      <div className="border-t border-white/10 bg-black/20">
        <div className="mx-auto max-w-7xl px-4 py-3 text-[11px] text-white/55 lg:px-6">
          출처: 공공데이터(PORT-MIS · 관세청 · 해양수산부) 기반 · 매주 업데이트
        </div>
      </div>
    </section>
  );
}

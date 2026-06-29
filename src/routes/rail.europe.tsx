import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";

import { latestNewsQueryOptions, type NewsItem } from "@/lib/api/news";
import { seoHead, type FaqItem } from "@/lib/seo";
import { GeoAnswerBlock } from "@/components/geo/GeoAnswerBlock";
import { RailNewsFeed } from "@/components/rail-page/RailWidgets";

// 유럽 — 전용 코리도 파이프라인은 준비 중. 현재는 index1520 메타피드의 유럽 관련 기사를 필터링해 노출.
const EUROPE_RE =
  /\b(europe|european|eu|poland|polish|warsaw|germany|german|rotterdam|hamburg|duisburg|antwerp|czech|hungary|hungarian|belgium|netherlands|dutch|france|french|baltic|cee|malaszewicze|brest|slovakia|austria|italy|spain|gdansk|koper|trieste|metrans)\b/i;

function isEurope(n: NewsItem) {
  const text = `${n.title} ${n.summary ?? ""} ${(n.tags ?? []).join(" ")}`;
  return EUROPE_RE.test(text);
}

// GEO: 답변 capsule + FAQ (실데이터 바인딩). 이 페이지는 뉴스 피드 — 운임 수치 날조 금지.
function fmtIsoDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return String(iso).slice(0, 10);
}
function buildEuropeGeo(euro: NewsItem[]) {
  const sorted = [...euro].sort((a, b) =>
    String(b.published_at ?? "").localeCompare(String(a.published_at ?? "")),
  );
  const latest = sorted[0] ?? null;
  const latestDate = latest?.published_at ?? null;

  const capsule =
    sorted.length > 0
      ? `유럽 철도 코리도어 관련 최신 뉴스 ${sorted.length}건을 index1520 메타피드에서 필터링해 제공합니다. 최신 기사: ${latest!.title} (${fmtIsoDate(latestDate)}).`
      : "유럽 철도 코리도어 관련 뉴스를 index1520 메타피드에서 필터링해 제공합니다. 현재 유럽 관련 기사는 수집 중입니다.";

  const faq: FaqItem[] = [];
  if (sorted.length > 0) {
    const heads = sorted
      .slice(0, 2)
      .map((n) => `${n.title} (${fmtIsoDate(n.published_at)})`)
      .join(" · ");
    faq.push({
      q: "유럽 철도 코리도어 최신 소식은 무엇인가요?",
      a: `최근 기사: ${heads}. 전체 ${sorted.length}건은 아래 피드에서 확인할 수 있습니다.`,
    });
  }
  faq.push({
    q: "유럽 철도 운임 지수도 제공하나요?",
    a: "전용 코리도 운임 파이프라인은 준비 중이며, 현재는 index1520 메타피드의 유럽 관련 기사 큐레이션을 제공합니다. 운임 지수 수치는 아직 표시하지 않습니다.",
  });
  faq.push({
    q: "뉴스 출처는 무엇인가요?",
    a: "index1520 메타피드에서 유럽 관련 기사를 필터링해 제공합니다.",
  });

  return { capsule, faq, latestDate };
}

export const Route = createFileRoute("/rail/europe")({
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(latestNewsQueryOptions({ category: "철도", lang: "en", limit: 30 }));
  },
  head: () =>
    seoHead({
      title: "유럽 철도 — Logisight",
      description: "유럽 철도 코리도 뉴스(index1520 메타피드, 유럽 관련 기사 필터).",
      path: "/rail/europe",
    }),
  component: RailEuropePage,
});

function RailEuropePage() {
  const { data: news } = useSuspenseQuery(
    latestNewsQueryOptions({ category: "철도", lang: "en", limit: 30 }),
  );
  const euro = news.filter(isEurope);
  const geo = buildEuropeGeo(euro);
  return (
    <div className="pt-2">
      <div className="mx-auto w-full max-w-[1240px] px-4 pt-7 min-[640px]:px-7">
        <div className="rounded-[12px] border border-[#78a0cd1c] bg-[#0e1626] px-5 py-4 text-[13px] leading-[1.6] text-[#93a1b7]">
          <b className="text-[#2dd4bf]">유럽 철도</b> — 전용 코리도 모니터링은 준비 중입니다. 현재는 index1520 메타피드에서{" "}
          <b className="text-[#e9eef7]">유럽 관련 기사</b>를 필터링해 보여드립니다.
        </div>
        <div className="mt-3.5">
          <GeoAnswerBlock
            capsule={geo.capsule}
            faq={geo.faq}
            tone="dark"
            sources="출처: index1520 메타피드 (유럽 철도 뉴스)"
            article={{
              headline: "유럽 철도 코리도 뉴스",
              description: "유럽 철도 코리도 뉴스(index1520 메타피드, 유럽 관련 기사 필터).",
              path: "/rail/europe",
              datePublished: geo.latestDate,
              dateModified: geo.latestDate,
            }}
          />
        </div>
      </div>
      <RailNewsFeed
        title="유럽 철도 뉴스"
        chip={`유럽 필터 · ${euro.length}건`}
        items={euro}
        emptyText="현재 유럽 관련 기사가 없습니다."
      />
    </div>
  );
}

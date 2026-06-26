import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";

import { latestNewsQueryOptions, type NewsItem } from "@/lib/api/news";
import { RailNewsFeed } from "@/components/rail-page/RailWidgets";

// 유럽 — 전용 코리도 파이프라인은 준비 중. 현재는 index1520 메타피드의 유럽 관련 기사를 필터링해 노출.
const EUROPE_RE =
  /\b(europe|european|eu|poland|polish|warsaw|germany|german|rotterdam|hamburg|duisburg|antwerp|czech|hungary|hungarian|belgium|netherlands|dutch|france|french|baltic|cee|malaszewicze|brest|slovakia|austria|italy|spain|gdansk|koper|trieste|metrans)\b/i;

function isEurope(n: NewsItem) {
  const text = `${n.title} ${n.summary ?? ""} ${(n.tags ?? []).join(" ")}`;
  return EUROPE_RE.test(text);
}

export const Route = createFileRoute("/rail/europe")({
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(latestNewsQueryOptions({ category: "철도", lang: "en", limit: 30 }));
  },
  head: () => ({
    meta: [
      { title: "유럽 철도 — Logisight" },
      { name: "description", content: "유럽 철도 코리도 뉴스(index1520 메타피드, 유럽 관련 기사 필터)." },
    ],
  }),
  component: RailEuropePage,
});

function RailEuropePage() {
  const { data: news } = useSuspenseQuery(
    latestNewsQueryOptions({ category: "철도", lang: "en", limit: 30 }),
  );
  const euro = news.filter(isEurope);
  return (
    <div className="pt-2">
      <div className="mx-auto w-full max-w-[1240px] px-4 pt-7 min-[640px]:px-7">
        <div className="rounded-[12px] border border-[#78a0cd1c] bg-[#0e1626] px-5 py-4 text-[13px] leading-[1.6] text-[#93a1b7]">
          <b className="text-[#2dd4bf]">유럽 철도</b> — 전용 코리도 모니터링은 준비 중입니다. 현재는 index1520 메타피드에서{" "}
          <b className="text-[#e9eef7]">유럽 관련 기사</b>를 필터링해 보여드립니다.
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

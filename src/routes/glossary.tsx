import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";

import { HomeNav } from "@/components/home/HomeNav";
import {
  CATEGORY_LABEL,
  GLOSSARY,
  searchGlossary,
  termAnchor,
  type GlossaryCategory,
} from "@/data/glossary";
import { seoHead } from "@/lib/seo";

// 물류 용어집. PHASE 3-2.
//
// 화면 곳곳에서 TEU·SCFI·결항률 같은 말을 설명 없이 쓴다. 그 자리에서는 ⓘ(MetricTerm)로
// 한 문장만 풀고, 전체 설명은 여기 모은다. "FEU 뜻"·"SCFI란" 같은 검색어가 실제로 있다.
//
// 검색어는 URL 쿼리로만 둔다(?q=). localStorage 를 쓰지 않는다 —— 링크를 공유하면 같은
// 화면이 나와야 한다. q 는 옵셔널이다: 기본값을 채우면 /glossary 가 307 로 정규화된다.

const searchSchema = z.object({
  q: z.string().optional().catch(undefined),
});

export const Route = createFileRoute("/glossary")({
  validateSearch: searchSchema,
  head: () =>
    seoHead({
      title: "물류 용어집 — TEU·FEU·SCFI·결항률 뜻 | Logisight",
      description:
        "컨테이너·운임 지수·항만 운영 용어 20가지를 한 문장 정의와 배경 설명으로 정리했습니다. TEU와 FEU의 차이, SCFI·CCFI·KCCI가 무엇을 재는지, 결항률과 체선·체화가 왜 비용이 되는지.",
      path: "/glossary",
    }),
  component: GlossaryPage,
});

const CATEGORY_ORDER: GlossaryCategory[] = ["container", "index", "measure", "operation"];

function GlossaryPage() {
  const q = Route.useSearch().q ?? "";
  const navigate = useNavigate({ from: "/glossary" });
  const results = searchGlossary(q);

  return (
    <div className="min-h-screen bg-[#070b16]">
      <HomeNav />

      <main className="mx-auto w-full max-w-[880px] px-[18px] py-10 min-[620px]:px-7">
        <h1 className="text-[24px] font-bold text-white">물류 용어집</h1>
        <p className="mt-2.5 text-[13.5px] leading-relaxed text-[#93a1b7]">
          이 사이트의 표와 지수에 나오는 말들을 모았습니다. 화면 안에서는 용어 옆 ⓘ 를 눌러
          한 문장으로 볼 수 있고, 여기서는 왜 그 숫자가 중요한지까지 적었습니다.
        </p>

        <div className="mt-6">
          <label htmlFor="glossary-q" className="sr-only">
            용어 검색
          </label>
          <input
            id="glossary-q"
            type="search"
            value={q}
            onChange={(e) => {
              const next = e.target.value;
              navigate({ search: next ? { q: next } : {}, replace: true });
            }}
            placeholder="용어·설명으로 검색 (예: TEU, 백분위, 결항)"
            className="w-full rounded-[10px] border border-[#1d2740] bg-[#0d1424] px-3.5 py-2.5 text-[14px] text-white placeholder:text-[#5d6b80] focus:border-[#2dd4bf] focus:outline-none"
          />
          {q ? (
            <p className="mt-2 text-[12px] text-[#5d6b80]">
              {results.length}개 용어가 “{q}”와 맞습니다.
            </p>
          ) : null}
        </div>

        {results.length === 0 ? (
          <p className="mt-10 text-[13.5px] text-[#93a1b7]">
            맞는 용어가 없습니다. 다른 말로 찾아보시거나 검색어를 지워 전체를 보세요.
          </p>
        ) : (
          CATEGORY_ORDER.map((cat) => {
            const items = results.filter((e) => e.category === cat);
            if (items.length === 0) return null;
            return (
              <section key={cat} className="mt-9">
                <h2 className="text-[12px] font-bold uppercase tracking-wider text-[#2dd4bf]">
                  {CATEGORY_LABEL[cat]}
                </h2>
                <dl className="mt-3 space-y-3">
                  {items.map((e) => (
                    <div
                      key={e.term}
                      // 앵커 — MetricTerm 의 "자세히 →" 가 이 id 로 들어온다.
                      id={termAnchor(e.term)}
                      className="scroll-mt-[96px] rounded-[12px] border border-[#1d2740] bg-[#0d1424] p-4"
                    >
                      <dt className="flex flex-wrap items-baseline gap-2">
                        <span className="text-[15px] font-bold text-white">{e.term}</span>
                        {e.aliases?.length ? (
                          <span className="text-[11.5px] text-[#5d6b80]">{e.aliases.join(" · ")}</span>
                        ) : null}
                      </dt>
                      <dd className="mt-1.5">
                        <p className="text-[13.5px] leading-relaxed text-[#c7d2e2]">{e.short}</p>
                        <p className="mt-1.5 text-[13px] leading-relaxed text-[#93a1b7]">{e.long}</p>
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            );
          })
        )}

        <p className="mt-10 text-[11.5px] text-[#5d6b80]">
          총 {GLOSSARY.length}개 용어. 설명은 일반적인 업계 정의이며, 각 지수의 산출 방식과 출처는{" "}
          <a href="/methodology" className="text-[#2dd4bf] hover:underline">
            데이터 방법론
          </a>
          에 정리돼 있습니다.
        </p>
      </main>
    </div>
  );
}

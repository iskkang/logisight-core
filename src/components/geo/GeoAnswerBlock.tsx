// GEO 답변 블록 — 페이지 상단(히어로 아래)에 답변우선 capsule + FAQ를 SSR로 렌더하고
// Article·FAQPage JSON-LD를 같은 데이터로 함께 출력한다. 수치는 전부 호출부에서 실데이터
// 바인딩(날조 금지). faq는 데이터로 답 가능한 항목만 전달 — 빈 배열이면 FAQPage 생략.
import { articleSchema, faqPageSchema, type ArticleSchemaInput, type FaqItem } from "@/lib/seo";

interface GeoAnswerBlockProps {
  /** 답변우선 한두 문장. 핵심 질문의 답을 첫 130~160자 안에. */
  capsule: string;
  faq?: FaqItem[];
  article: ArticleSchemaInput;
  /** 페이지 배경에 맞춰 톤 선택. */
  tone?: "light" | "dark";
  /** 출처 표기. 예: "출처: ERAI(index1520)" */
  sources?: string;
  className?: string;
}

export function GeoAnswerBlock({
  capsule,
  faq = [],
  article,
  tone = "light",
  sources,
  className = "",
}: GeoAnswerBlockProps) {
  const dark = tone === "dark";
  const cardCls = dark
    ? "border-[#22304a] bg-[#0e1626]"
    : "border-[#d8dfe9] bg-[#f4f7fb]";
  const headCls = dark ? "text-[#e9eef7]" : "text-[#1a2433]";
  const bodyCls = dark ? "text-[#c7d2e0]" : "text-[#46505f]";
  const mutedCls = dark ? "text-[#8595ab]" : "text-[#828d9d]";
  const divider = dark ? "#22304a" : "#e2e8f1";

  const schemas: object[] = [articleSchema(article)];
  if (faq.length > 0) schemas.push(faqPageSchema(faq));

  return (
    <section
      className={`rounded-[14px] border px-5 py-4 ${cardCls} ${className}`}
      aria-label="페이지 요약 및 자주 묻는 질문"
    >
      <p className={`text-[14px] font-medium leading-[1.7] ${headCls}`}>{capsule}</p>
      {sources && <p className={`mt-1.5 text-[11px] ${mutedCls}`}>{sources}</p>}

      {faq.length > 0 && (
        <div className="mt-3 border-t pt-3" style={{ borderColor: divider }}>
          <dl className="space-y-2.5">
            {faq.map((f, i) => (
              <div key={i}>
                <dt className={`text-[13px] font-semibold ${headCls}`}>{f.q}</dt>
                <dd className={`mt-1 text-[12.5px] leading-[1.65] ${bodyCls}`}>{f.a}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {schemas.map((s, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(s) }}
        />
      ))}
    </section>
  );
}

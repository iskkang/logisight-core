// 보이지 않는 Article JSON-LD만 출력(시각 요소 없음). 페이지 디자인에 영향 주지 않으면서
// GEO용 Article 스키마를 SSR HTML에 유지하기 위한 컴포넌트. FAQ는 /faq 페이지로 분리.
import { articleSchema, type ArticleSchemaInput } from "@/lib/seo";

export function GeoArticleSchema({ article }: { article: ArticleSchemaInput }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema(article)) }}
    />
  );
}

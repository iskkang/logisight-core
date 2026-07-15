// 전 라우트 메타 일원화 헬퍼. 입력 {title, description, path, image?, type?} →
// title·description·canonical·og·twitter 전체 세트를 반환한다. ABS(path)는 항상
// production 도메인(logisight.mtlship.com) 기준 — vercel.app·lovable 절대 금지.
// 사용: head: () => seoHead({ title, description, path: "/rates" })

const SITE_URL = "https://logisight.mtlship.com";
const SITE_NAME = "Logisight";
const DEFAULT_IMAGE = `${SITE_URL}/og-default.jpg`;

/** 경로(또는 절대 URL)를 production 절대 URL로 변환. */
export function abs(pathOrUrl: string): string {
  if (/^https?:\/\//.test(pathOrUrl)) return pathOrUrl;
  return `${SITE_URL}${pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`}`;
}

export interface SeoInput {
  title: string;
  description: string;
  /** 페이지 자기 경로. 예: "/", "/rates", `/article/${slug}` */
  path: string;
  /** og:image. 경로/절대 URL 모두 허용. 생략 시 /og-default.jpg */
  image?: string | null;
  type?: "website" | "article";
}

/** TanStack Router head()가 반환할 { meta, links } 세트. 라우트별 head에서 펼쳐 사용. */
export function seoHead({ title, description, path, image, type = "website" }: SeoInput) {
  const url = abs(path);
  const img = image ? abs(image) : DEFAULT_IMAGE;
  return {
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: type },
      { property: "og:url", content: url },
      { property: "og:site_name", content: SITE_NAME },
      { property: "og:image", content: img },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: img },
    ] as Array<Record<string, string>>,
    links: [{ rel: "canonical", href: url }] as Array<Record<string, string>>,
  };
}

/* ===================== JSON-LD 스키마 빌더 (GEO) ===================== */
// SSR HTML에 출력되는 페이지 스키마. 모든 수치는 호출부에서 실데이터로 바인딩한다.

const PUBLISHER = {
  "@type": "Organization",
  name: "MTL Shipping Agency",
  logo: { "@type": "ImageObject", url: `${SITE_URL}/logisight_logo.svg` },
};

export interface ArticleSchemaInput {
  headline: string;
  description: string;
  /** 자기 경로. mainEntityOfPage = ABS(path) */
  path: string;
  datePublished?: string | null;
  dateModified?: string | null;
  image?: string | null;
}

/** 데이터/분석 페이지용 Article 스키마. */
export function articleSchema(i: ArticleSchemaInput) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: i.headline,
    description: i.description,
    image: [i.image ? abs(i.image) : DEFAULT_IMAGE],
    datePublished: i.datePublished ?? undefined,
    dateModified: i.dateModified ?? i.datePublished ?? undefined,
    author: { "@type": "Organization", name: "MTL Shipping Agency" },
    publisher: PUBLISHER,
    mainEntityOfPage: abs(i.path),
  };
}

export interface FaqItem {
  q: string;
  a: string;
}

/** FAQPage 스키마. items는 실데이터로 답할 수 있는 질문만 포함(빈 배열이면 호출부에서 생략). */
export function faqPageSchema(items: FaqItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((it) => ({
      "@type": "Question",
      name: it.q,
      acceptedAnswer: { "@type": "Answer", text: it.a },
    })),
  };
}

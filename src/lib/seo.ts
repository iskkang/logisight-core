// 전 라우트 메타 일원화 헬퍼. 입력 {title, description, path, image?, type?} →
// title·description·canonical·og·twitter 전체 세트를 반환한다. ABS(path)는 항상
// production 도메인 기준 — vercel.app 절대 금지.
// 사용: head: () => seoHead({ title, description, path: "/rates" })
//
// SITE_URL은 사이트 전역 도메인 단일 소스 — sitemap·__root·article·indexnow가 여기서 가져간다.
// 정본은 apex(www 아님). www.logisight.net은 Vercel에서 apex로 308 리다이렉트되므로,
// 생성되는 canonical·<loc>·IndexNow 제출 URL이 www를 타면 안 된다.
export const SITE_URL = "https://logisight.net";
/** 스킴 없는 호스트 — IndexNow처럼 호스트만 받는 곳에서 사용. */
export const SITE_HOST = SITE_URL.replace(/^https?:\/\//, "");
const SITE_NAME = "Logisight";
/** 일본판 도메인. hreflang 상호 선언에만 쓴다. */
export const JA_SITE_URL = "https://jpn.logisight.net";
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
  /**
   * 같은 내용을 다루는 일본판 경로. 넘기면 hreflang 3종(ko·ja·x-default)을 낸다.
   *
   * ★ 상호 선언이 아니면 무효다.
   * 일본판(logisight-jp)은 예전부터 ko/ja/x-default 를 선언하고 있었는데 이쪽에는
   * hreflang 코드가 한 줄도 없었다. Google 은 서로를 가리키지 않는 hreflang 을 무시하므로
   * 일본판의 선언이 전부 무효였다. 양쪽이 같은 짝을 가리켜야 성립한다.
   *
   * 대응 페이지가 실제로 있는 라우트에만 넘긴다. 없는 곳을 가리키면 안 하느니만 못하다.
   */
  jaPath?: string;
}

/** TanStack Router head()가 반환할 { meta, links } 세트. 라우트별 head에서 펼쳐 사용. */
export function seoHead({ title, description, path, image, type = "website", jaPath }: SeoInput) {
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
    links: buildLinks(url, jaPath),
  };
}

/** canonical + (짝이 있으면) hreflang 3종. */
function buildLinks(url: string, jaPath?: string): Array<Record<string, string>> {
  const links: Array<Record<string, string>> = [{ rel: "canonical", href: url }];
  if (!jaPath) return links;
  const ja = `${JA_SITE_URL}${jaPath.startsWith("/") ? jaPath : `/${jaPath}`}`;
  // 키가 그대로 속성으로 나가므로 규격대로 소문자 hreflang 을 쓴다.
  links.push(
    { rel: "alternate", hreflang: "ko", href: url },
    { rel: "alternate", hreflang: "ja", href: ja },
    // x-default 는 한국(이 사이트)이다. 일본판도 같은 곳을 가리키도록 맞춰 뒀다 ——
    // 양쪽이 서로 다른 x-default 를 내면 그 자체가 모순이라 무시된다.
    { rel: "alternate", hreflang: "x-default", href: url },
  );
  return links;
}

/* ===================== JSON-LD 스키마 빌더 (GEO) ===================== */
// SSR HTML에 출력되는 페이지 스키마. 모든 수치는 호출부에서 실데이터로 바인딩한다.

// 발행자는 Logisight — 운영 법인(MTL Shipping Agency)은 parentOrganization으로 __root에서 공시한다.
const PUBLISHER = {
  "@type": "Organization",
  name: SITE_NAME,
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
    author: { "@type": "Organization", name: SITE_NAME },
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

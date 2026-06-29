// 전 라우트 메타 일원화 헬퍼. 입력 {title, description, path, image?, type?} →
// title·description·canonical·og·twitter 전체 세트를 반환한다. ABS(path)는 항상
// production 도메인(logisight.mtlship.com) 기준 — vercel.app·lovable 절대 금지.
// 사용: head: () => seoHead({ title, description, path: "/rates" })

const SITE_URL = "https://logisight.mtlship.com";
const SITE_NAME = "Logisight";
const DEFAULT_IMAGE = `${SITE_URL}/og-default.png`;

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
  /** og:image. 경로/절대 URL 모두 허용. 생략 시 /og-default.png */
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

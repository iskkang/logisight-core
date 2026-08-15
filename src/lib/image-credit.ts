/**
 * 기사 이미지 크레딧 — 표시 문구와 링크를 만든다.
 *
 * ■ 왜 강화하나
 * 기사 이미지는 두 갈래다. 원문 매체의 og:image 를 그대로 쓰거나(image_source:
 * "original"), Unsplash 폴백이거나(image_source: "unsplash").
 *
 * 원문 이미지를 계속 쓰기로 했으므로(핫링킹 유지), 최소한 그 사진이 누구 것인지는
 * 분명해야 한다. 지금까지 figcaption 에는 매체명만 덩그러니 있었다 —— "Lloyd's List"
 * 라고만 적혀 있으면 그게 사진 출처인지 기사 출처인지 읽는 사람이 알 수 없다.
 *
 * Unsplash 쪽은 API 가이드라인이 작가·Unsplash 로 링크를 걸고 utm_source 를 붙일 것을
 * 요구한다. 작가 프로필 링크는 DB 에 저장돼 있지 않아(image_credit 이 평문 문자열)
 * 지금은 Unsplash 로만 건다. 작가 링크까지는 컬럼 추가가 필요해 별건이다.
 *
 * 순수 함수 —— 렌더러가 아니라 여기서 판정한다.
 */

export type ImageCredit = { text: string; href: string | null };

const UNSPLASH_REFERRAL = "https://unsplash.com/?utm_source=logisight&utm_medium=referral";

function safeHttpUrl(url: string | null): string | null {
  if (!url) return null;
  return /^https?:\/\//.test(url) ? url : null;
}

export function buildImageCredit(input: {
  imageCredit: string | null;
  imageSource: string | null;
  articleUrl: string | null;
}): ImageCredit | null {
  const credit = input.imageCredit?.trim();
  if (!credit) return null;

  if (input.imageSource === "unsplash") {
    return { text: credit, href: UNSPLASH_REFERRAL };
  }

  if (input.imageSource === "original") {
    // 사진임을 명시하고 원문 기사로 보낸다. 원문 URL 은 이미 저장돼 있어
    // 스키마를 건드리지 않고도 출처를 짚어줄 수 있다.
    return { text: `사진 ⓒ ${credit}`, href: safeHttpUrl(input.articleUrl) };
  }

  return { text: credit, href: null };
}

import { describe, it, expect } from "vitest";
import { isSampleArticleUrl, isRedirectableUrl } from "@/lib/api/article";

describe("isSampleArticleUrl", () => {
  it("신 도메인 샘플 URL", () => {
    expect(isSampleArticleUrl("https://logisight.net/sample/abc")).toBe(true);
  });

  it("구 도메인 샘플 URL — DB에 남아 있는 기존 행이 계속 인식돼야 한다", () => {
    expect(isSampleArticleUrl("https://logisight.mtlship.com/sample/abc")).toBe(true);
  });

  it("자체 도메인이어도 /sample이 아니면 샘플이 아니다", () => {
    expect(isSampleArticleUrl("https://logisight.net/article/2026-08-03-ocean")).toBe(false);
  });

  it("외부 기사 URL", () => {
    expect(isSampleArticleUrl("https://splash247.com/some-article")).toBe(false);
  });

  it("null·빈 문자열", () => {
    expect(isSampleArticleUrl(null)).toBe(false);
    expect(isSampleArticleUrl("")).toBe(false);
  });
});

describe("isRedirectableUrl", () => {
  it("정상 외부 기사 URL", () => {
    expect(isRedirectableUrl("https://splash247.com/some-article")).toBe(true);
    expect(isRedirectableUrl("http://example.co.kr/a?b=1")).toBe(true);
  });

  // 프로덕션 /article/18842가 실제로 내놓던 값 — 접두어 검사만으로는 통과한다
  it("스킴 접두어만 맞는 쓰레기 값 — https://javascript:void(0);", () => {
    expect(isRedirectableUrl("https://javascript:void(0);")).toBe(false);
  });

  it("점 없는 호스트 — https://javascript", () => {
    expect(isRedirectableUrl("https://javascript")).toBe(false);
  });

  it("http(s)가 아닌 스킴", () => {
    expect(isRedirectableUrl("javascript:void(0);")).toBe(false);
    expect(isRedirectableUrl("mailto:a@b.com")).toBe(false);
  });

  it("상대 경로·null·빈 문자열", () => {
    expect(isRedirectableUrl("/article/123")).toBe(false);
    expect(isRedirectableUrl(null)).toBe(false);
    expect(isRedirectableUrl("")).toBe(false);
  });
});

import { describe, it, expect } from "vitest";
import { isSampleArticleUrl } from "@/lib/api/article";

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

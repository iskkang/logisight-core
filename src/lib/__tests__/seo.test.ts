import { describe, it, expect } from "vitest";
import { SITE_URL, SITE_HOST, abs, seoHead } from "@/lib/seo";

describe("SITE_URL", () => {
  it("정본 도메인 — apex(www 아님). www는 apex로 308 리다이렉트되므로 생성물이 타면 안 된다", () => {
    expect(SITE_URL).toBe("https://logisight.net");
  });

  it("SITE_HOST는 스킴을 뺀 호스트 — IndexNow 등 호스트만 필요한 곳에서 사용", () => {
    expect(SITE_HOST).toBe("logisight.net");
  });
});

describe("abs", () => {
  it("경로를 정본 절대 URL로 변환", () => {
    expect(abs("/rates")).toBe("https://logisight.net/rates");
  });

  it("앞 슬래시가 없어도 붙여준다", () => {
    expect(abs("rates")).toBe("https://logisight.net/rates");
  });

  it("이미 절대 URL이면 그대로 둔다 — 외부 이미지 호스트 보존", () => {
    expect(abs("https://cdn.example/a.jpg")).toBe("https://cdn.example/a.jpg");
  });
});

describe("seoHead", () => {
  it("canonical·og:url이 정본 도메인 — sitemap <loc>와 문자 단위로 일치해야 통합이 작동", () => {
    const { meta, links } = seoHead({ title: "t", description: "d", path: "/reports" });
    expect(links[0]).toEqual({ rel: "canonical", href: "https://logisight.net/reports" });
    expect(meta).toContainEqual({ property: "og:url", content: "https://logisight.net/reports" });
  });

  it("image 생략 시 기본 og 이미지도 정본 도메인", () => {
    const { meta } = seoHead({ title: "t", description: "d", path: "/" });
    expect(meta).toContainEqual({
      property: "og:image",
      content: "https://logisight.net/og-default.jpg",
    });
  });
});

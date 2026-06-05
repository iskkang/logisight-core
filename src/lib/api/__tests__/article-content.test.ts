import { describe, expect, it } from "vitest";

import { normalizeArticleContent } from "../../article-content";

describe("normalizeArticleContent", () => {
  it("removes duplicate title, summary, hero image, and credit", () => {
    const content = `# 같은 제목

## 같은 요약

![같은 제목](https://example.com/hero.jpg)
*Photo: Example*

## 현상

본문입니다.`;

    expect(
      normalizeArticleContent({
        content,
        title: "같은 제목",
        summary: "같은 요약",
        imageUrl: "https://example.com/hero.jpg",
        imageCredit: "Photo: Example",
      }),
    ).toBe("본문입니다.");
  });

  it("preserves different headings and inline images", () => {
    const content = `## 배경

![도표](https://example.com/chart.jpg)

분석입니다.`;

    expect(
      normalizeArticleContent({
        content,
        title: "제목",
        summary: "요약",
        imageUrl: "https://example.com/hero.jpg",
        imageCredit: null,
      }),
    ).toBe(content);
  });
});

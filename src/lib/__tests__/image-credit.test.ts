import { describe, expect, it } from "vitest";

import { buildImageCredit } from "../image-credit";

describe("buildImageCredit", () => {
  it("크레딧이 없으면 아무것도 만들지 않는다", () => {
    expect(buildImageCredit({ imageCredit: null, imageSource: "original", articleUrl: "https://a.com/x" })).toBeNull();
    expect(buildImageCredit({ imageCredit: "   ", imageSource: "original", articleUrl: "https://a.com/x" })).toBeNull();
  });

  it("원문 이미지는 사진임을 명시하고 원문 기사로 링크한다", () => {
    expect(
      buildImageCredit({ imageCredit: "Lloyd's List", imageSource: "original", articleUrl: "https://lloydslist.com/a" }),
    ).toEqual({ text: "사진 ⓒ Lloyd's List", href: "https://lloydslist.com/a" });
  });

  it("원문 URL 이 http(s) 가 아니면 링크를 걸지 않는다 (문구는 유지)", () => {
    expect(
      buildImageCredit({ imageCredit: "Lloyd's List", imageSource: "original", articleUrl: "javascript:alert(1)" }),
    ).toEqual({ text: "사진 ⓒ Lloyd's List", href: null });
    expect(
      buildImageCredit({ imageCredit: "Lloyd's List", imageSource: "original", articleUrl: null }),
    ).toEqual({ text: "사진 ⓒ Lloyd's List", href: null });
  });

  it("Unsplash 는 문구를 그대로 두고 utm_source 를 붙인 링크를 건다", () => {
    expect(
      buildImageCredit({ imageCredit: "Photo: Jane Doe / Unsplash", imageSource: "unsplash", articleUrl: null }),
    ).toEqual({
      text: "Photo: Jane Doe / Unsplash",
      href: "https://unsplash.com/?utm_source=logisight&utm_medium=referral",
    });
  });

  it("출처 구분이 없으면 문구만 쓰고 링크는 걸지 않는다", () => {
    expect(buildImageCredit({ imageCredit: "직접 촬영", imageSource: null, articleUrl: "https://a.com/x" })).toEqual({
      text: "직접 촬영",
      href: null,
    });
  });
});

import { describe, expect, it } from "vitest";

import { normalizeNewsImage, sanitizeNewsImageUrl } from "../news-image";

describe("sanitizeNewsImageUrl", () => {
  it("keeps absolute HTTP image URLs", () => {
    expect(sanitizeNewsImageUrl("https://images.example.com/photo.jpg")).toBe(
      "https://images.example.com/photo.jpg",
    );
  });

  it("rejects malformed and relative image URLs", () => {
    expect(sanitizeNewsImageUrl('"')).toBeNull();
    expect(sanitizeNewsImageUrl("&quot;")).toBeNull();
    expect(sanitizeNewsImageUrl("/%22")).toBeNull();
    expect(sanitizeNewsImageUrl("https://example.com/article/%22")).toBeNull();
    expect(sanitizeNewsImageUrl("javascript:void(0)")).toBeNull();
  });

  it("normalizes invalid item image URLs to null", () => {
    expect(
      normalizeNewsImage({ id: 1, url: "https://example.com/article", category: null, image_url: '"' }),
    ).toMatchObject({ image_url: null });
  });
});

describe("normalizeNewsImage — gcaptain fallback", () => {
  const base = { id: 1, category: null };

  it("replaces gcaptain image with Unsplash URL", () => {
    const result = normalizeNewsImage({
      ...base,
      url: "https://gcaptain.com/some-article",
      image_url: "https://gcaptain.com/wp-content/uploads/photo.jpg",
    });
    expect(result.image_url).toMatch(/^https:\/\/images\.unsplash\.com\/photo-/);
    expect(result.image_source).toBe("unsplash");
  });

  it("replaces gcaptain image even when image_url is null", () => {
    const result = normalizeNewsImage({
      ...base,
      url: "https://gcaptain.com/some-article",
      image_url: null,
    });
    expect(result.image_url).toMatch(/^https:\/\/images\.unsplash\.com\/photo-/);
  });

  it("does not touch non-gcaptain images", () => {
    const result = normalizeNewsImage({
      ...base,
      url: "https://lloydslist.com/some-article",
      image_url: "https://lloydslist.com/images/photo.jpg",
    });
    expect(result.image_url).toBe("https://lloydslist.com/images/photo.jpg");
  });

  it("returns different Unsplash photos for different article IDs", () => {
    const make = (id: number) =>
      normalizeNewsImage({ id, url: "https://gcaptain.com/article", image_url: null, category: null });
    const urls = new Set([0, 1, 2, 3, 4].map((id) => make(id).image_url));
    expect(urls.size).toBeGreaterThan(1);
  });
});

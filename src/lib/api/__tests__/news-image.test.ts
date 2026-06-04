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
    expect(normalizeNewsImage({ image_url: '"' })).toEqual({ image_url: null });
  });
});

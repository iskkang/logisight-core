import type { NewsItem } from "./news";

export function sanitizeNewsImageUrl(value: string | null): string | null {
  if (!value) return null;
  const raw = value.trim();
  if (!raw || /["'<>]|%(?:22|27|3c|3e)|&(?:quot|apos|#0*3[49]);/i.test(raw)) return null;

  try {
    const url = new URL(raw);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

export function normalizeNewsImage<T extends Pick<NewsItem, "image_url">>(item: T): T {
  const imageUrl = sanitizeNewsImageUrl(item.image_url);
  return imageUrl === item.image_url ? item : { ...item, image_url: imageUrl };
}

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

// Curated Unsplash photo IDs for maritime/shipping topics.
// Format: https://images.unsplash.com/photo-{id}?auto=format&fit=crop&w=800&q=80
const UNSPLASH_POOL: Record<string, string[]> = {
  shipping: [
    "1494412574643-ff11b0a5c1c3", // container ship aerial
    "1521037213-ddcf7da0f1e8", // cargo vessel at sea
    "1578575437130-527eed3abbec", // port cranes
    "1559592413-7cec4d83e851", // ship deck / bow
    "1449824913935-59a10b8d2000", // ship at port
  ],
  port: [
    "1578575437130-527eed3abbec", // port cranes
    "1504309092620-6c40ba3ee5dc", // terminal night
    "1449824913935-59a10b8d2000", // container terminal
  ],
  logistics: [
    "1553413077-190dd305871c", // warehouse logistics
    "1601584968588-07e56f4fb71c", // freight truck
    "1567769024820-1680c5cc5a58", // stacked containers
  ],
  aviation: [
    "1436491865332-7a61a109cc05", // cargo aircraft
    "1583147610148-5c97b6268a1e", // airport tarmac
  ],
  default: [
    "1494412574643-ff11b0a5c1c3",
    "1578575437130-527eed3abbec",
    "1521037213-ddcf7da0f1e8",
    "1553413077-190dd305871c",
    "1559592413-7cec4d83e851",
  ],
};

function unsplashUrl(photoId: string): string {
  return `https://images.unsplash.com/photo-${photoId}?auto=format&fit=crop&w=800&q=80`;
}

function pickUnsplashImage(id: number, category: string | null): string {
  const cat = category?.toLowerCase() ?? "";
  const pool =
    UNSPLASH_POOL[cat] ??
    (cat.includes("port") || cat.includes("항만")
      ? UNSPLASH_POOL.port
      : cat.includes("air") || cat.includes("항공")
        ? UNSPLASH_POOL.aviation
        : cat.includes("log") || cat.includes("물류")
          ? UNSPLASH_POOL.logistics
          : UNSPLASH_POOL.default);
  return unsplashUrl(pool[id % pool.length]);
}

function isGcaptainUrl(url: string): boolean {
  try {
    return new URL(url).hostname.endsWith("gcaptain.com");
  } catch {
    return false;
  }
}

type NormalizeInput = Pick<NewsItem, "image_url" | "url" | "id" | "category">;
type NormalizeOutput<T> = T & { image_url: string | null; image_source?: string | null; image_credit?: string | null };

export function normalizeNewsImage<T extends NormalizeInput>(item: T): NormalizeOutput<T> {
  // gcaptain blocks hotlinking (403) — replace with Unsplash
  if (isGcaptainUrl(item.url)) {
    return {
      ...item,
      image_url: pickUnsplashImage(item.id, item.category),
      image_source: "unsplash",
      image_credit: "Unsplash",
    } as NormalizeOutput<T>;
  }

  const imageUrl = sanitizeNewsImageUrl(item.image_url);
  return (imageUrl === item.image_url ? item : { ...item, image_url: imageUrl }) as NormalizeOutput<T>;
}

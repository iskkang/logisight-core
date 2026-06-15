export function numUSD(v: string | number | null | undefined): number | null {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const cleaned = v.replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function parseTransit(v: string | null | undefined): { min: number | null; max: number | null } {
  if (!v) return { min: null, max: null };
  const nums = String(v).match(/\d+/g);
  if (!nums || nums.length === 0) return { min: null, max: null };
  const a = Number(nums[0]);
  const b = nums.length > 1 ? Number(nums[1]) : a;
  return { min: a, max: b };
}

export function normRouteType(v: string | null | undefined): "DIRECT" | "T_S" | null {
  if (!v) return null;
  const s = v.trim().toUpperCase();
  if (s.startsWith("DIRECT")) return "DIRECT";
  if (s.includes("T/S") || s.includes("T.S") || s.includes("TS ")) return "T_S";
  return null;
}

export function isExpired(validUntil: string | null | undefined, today: string): boolean {
  if (!validUntil) return false;
  return validUntil < today;
}

// 국가 → KITA 권역. /rates 실측 패널을 권역 단위로 필터하기 위함(KITA에 없는 항만도 권역으로 묶음).
// 권역 문자열은 kita_sea_rates.region 값과 정확히 일치해야 함.
const COUNTRY_REGION: Record<string, string> = {
  // 아시아
  INDIA: "아시아", BANGLADESH: "아시아", PAKISTAN: "아시아", "SRI LANKA": "아시아",
  VIETNAM: "아시아", THAILAND: "아시아", INDONESIA: "아시아", MALAYSIA: "아시아",
  PHILIPPINES: "아시아", MYANMAR: "아시아", SINGAPORE: "아시아", CAMBODIA: "아시아",
  // 중남미
  MEXICO: "중남미", CHILE: "중남미", COLOMBIA: "중남미", PANAMA: "중남미", ECUADOR: "중남미",
  GUATEMALA: "중남미", PERU: "중남미", NICARAGUA: "중남미", "COSTA RICA": "중남미",
  "EL SALVADOR": "중남미", BRAZIL: "중남미", ARGENTINA: "중남미", URUGUAY: "중남미", HONDURAS: "중남미",
  // 아프리카
  NIGERIA: "아프리카", TOGO: "아프리카", "COTE D'IVOIRE": "아프리카", GHANA: "아프리카",
  BENIN: "아프리카", "EQUATORIAL GUINEA": "아프리카", SENEGAL: "아프리카", GUINEA: "아프리카",
  "SIERRA LEONE": "아프리카", LIBERIA: "아프리카", MAURITANIA: "아프리카", ANGOLA: "아프리카",
  CONGO: "아프리카", CAMEROON: "아프리카", "SOUTH AFRICA": "아프리카", TANZANIA: "아프리카",
  KENYA: "아프리카", MOZAMBIQUE: "아프리카", MADAGASCAR: "아프리카", EGYPT: "아프리카",
};

export function regionOfCountry(country: string | null | undefined): string | null {
  if (!country) return null;
  const k = country.trim().toUpperCase();
  if (k === "방글라" || k.includes("BANGLA")) return "아시아";
  return COUNTRY_REGION[k] ?? null;
}

// country 없을 때 폴백용 — 국가명이 안 붙는 단일 항만명 사전.
const PORT_REGION: Record<string, string> = {
  KARACHI: "아시아", CHENNAI: "아시아", KOLKATA: "아시아", VISAKHAPATNAM: "아시아",
  "NHAVA SHEVA": "아시아", PIPAVAV: "아시아", MUNDRA: "아시아", COLOMBO: "아시아", CHITTAGONG: "아시아",
};

// 권역 결정: country 우선 → POD에 박힌 국가명 → 단일 항만 사전.
export function regionOf(
  country: string | null | undefined,
  pod: string | null | undefined,
): string | null {
  const byCountry = regionOfCountry(country);
  if (byCountry) return byCountry;
  if (!pod) return null;
  const up = pod.toUpperCase();
  if (up.includes("BANGLA")) return "아시아";
  for (const c of Object.keys(COUNTRY_REGION)) {
    if (up.includes(c)) return COUNTRY_REGION[c];
  }
  for (const p of Object.keys(PORT_REGION)) {
    if (up.includes(p)) return PORT_REGION[p];
  }
  return null;
}

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

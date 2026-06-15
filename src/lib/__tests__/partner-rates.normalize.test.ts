import { describe, it, expect } from "vitest";
import { numUSD, parseTransit, normRouteType, isExpired, regionOfCountry, regionOf } from "../api/partner-rates.normalize";

describe("numUSD", () => {
  it("strips currency symbols and commas", () => {
    expect(numUSD("$6,200")).toBe(6200);
    expect(numUSD("4,950")).toBe(4950);
    expect(numUSD(6200)).toBe(6200);
    expect(numUSD("")).toBeNull();
    expect(numUSD(null)).toBeNull();
    expect(numUSD("N/A")).toBeNull();
  });
});

describe("parseTransit", () => {
  it("parses ranges and single values", () => {
    expect(parseTransit("14~18")).toEqual({ min: 14, max: 18 });
    expect(parseTransit("37")).toEqual({ min: 37, max: 37 });
    expect(parseTransit("22-26")).toEqual({ min: 22, max: 26 });
    expect(parseTransit("")).toEqual({ min: null, max: null });
    expect(parseTransit(null)).toEqual({ min: null, max: null });
  });
});

describe("normRouteType", () => {
  it("maps free text to DIRECT/T_S/null", () => {
    expect(normRouteType("DIRECT")).toBe("DIRECT");
    expect(normRouteType("direct")).toBe("DIRECT");
    expect(normRouteType("T/S CLL")).toBe("T_S");
    expect(normRouteType("T/S BUN or LZC")).toBe("T_S");
    expect(normRouteType("DIRECT or T/S ZLO")).toBe("DIRECT");
    expect(normRouteType("")).toBeNull();
  });
});

describe("isExpired", () => {
  it("true when valid_until is before today", () => {
    expect(isExpired("2026-06-14", "2026-06-15")).toBe(true);
    expect(isExpired("2026-06-15", "2026-06-15")).toBe(false);
    expect(isExpired("2026-06-30", "2026-06-15")).toBe(false);
    expect(isExpired(null, "2026-06-15")).toBe(false);
  });
});

describe("regionOfCountry", () => {
  it("maps countries to KITA regions", () => {
    expect(regionOfCountry("MEXICO")).toBe("중남미");
    expect(regionOfCountry("Chile")).toBe("중남미");
    expect(regionOfCountry("INDIA")).toBe("아시아");
    expect(regionOfCountry("방글라")).toBe("아시아");
    expect(regionOfCountry("NIGERIA")).toBe("아프리카");
    expect(regionOfCountry("SOUTH AFRICA")).toBe("아프리카");
    expect(regionOfCountry("베트남")).toBe("아시아");
    expect(regionOfCountry("말레이시아")).toBe("아시아");
    expect(regionOfCountry("U.A.E")).toBe("중동");
    expect(regionOfCountry(null)).toBeNull();
    expect(regionOfCountry("ATLANTIS")).toBeNull();
  });
});

describe("regionOf (POD fallback)", () => {
  it("uses country first, then POD country name, then bare port", () => {
    expect(regionOf("MEXICO", "MANZANILLO, MEXICO")).toBe("중남미"); // country
    expect(regionOf(null, "MANZANILLO, MEXICO")).toBe("중남미"); // POD에 국가명
    expect(regionOf(null, "KARACHI")).toBe("아시아"); // 단일 항만 사전
    expect(regionOf("", "DURBAN, SOUTH AFRICA")).toBe("아프리카");
    expect(regionOf(null, "LONG BEACH, CA")).toBe("북미"); // 미국 주 약자
    expect(regionOf(null, "HOUSTON, TX")).toBe("북미");
    expect(regionOf("SAUDI ARABIA", "JEDDAH")).toBe("중동");
    expect(regionOf("AUSTRALIA", "SYDNEY")).toBe("오세아니아");
    expect(regionOf(null, "JEBEL ALI")).toBe("중동"); // 항만 사전
    expect(regionOf(null, "UNKNOWNPORT")).toBeNull();
  });
});

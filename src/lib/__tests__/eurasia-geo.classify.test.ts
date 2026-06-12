import { describe, it, expect } from "vitest";
import { resolveDelayLocation } from "@/lib/eurasia-geo";

describe("resolveDelayLocation classification", () => {
  const cases: Array<[string, string, string]> = [
    ["Kaliningrad → Saint Petersburg", "", "corridor"],
    ["Taicang tiger cntr service Co.", "", "facility_city_match"],
    ["Xi'an → Małaszewicze", "", "corridor"],
    ["T/S Border → ANDIJAN", "", "partial"],
    ["Saryagach", "", "location"],
    ["Kulunda", "", "location"],
    ["Chukursaj", "", "location"],
    ["Qingdao → Xi'an", "", "corridor"],
    ["Qingdao → Kashgar", "", "corridor"],
    ["Aksu", "", "ambiguous"], // no context
    ["Aksu", "Qingdao → Kashgar 노선", "location"], // China context resolves
    ["구간", "", "unmapped"],
  ];
  it.each(cases)("%s (ctx=%s) → %s", (seg, ctx, expected) => {
    const r = resolveDelayLocation(seg, ctx);
    // eslint-disable-next-line no-console
    console.log(`${seg.padEnd(34)} ctx[${ctx}] => ${r.type}`);
    expect(r.type).toBe(expected);
  });
});

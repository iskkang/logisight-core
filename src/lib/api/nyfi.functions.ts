import { createServerFn } from "@tanstack/react-start";

import type { NyfiLane } from "./nyfi";

const NYFI_URL = "https://codeaccelerator.in/client/nyshex/";

const LANE_KO: Record<string, string> = {
  "ASIA-USWC": "아시아→미서안",
  "ASIA-USEC": "아시아→미동안",
  "ASIA-NEUR": "아시아→북유럽",
  "TRANS-ATLANTIC_WESTBOUND": "대서양(서행)",
  "TRANS-ATLANTIC_EASTBOUND": "대서양(동행)",
};

function normalizeName(raw: string): string {
  return raw.replace(/^\(Beta\)\s*/i, "").trim().replace(/\s+/g, "_");
}

type RawTrade = {
  name: string;
  containerType?: string;
  value: number;
  wow: number;
  absoluteWow: number;
  trend: number[];
};

export const getNyfiData = createServerFn({ method: "GET" }).handler(
  async (): Promise<NyfiLane[]> => {
    try {
      const res = await fetch(NYFI_URL, {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) {
        console.error(`NYFI fetch failed: ${res.status}`);
        return [];
      }
      const data = (await res.json()) as { twoYearsTrades?: RawTrade[] };

      // Latest Friday (UTC) — NYFI publishes weekly on Fridays
      const today = new Date();
      const daysToFri = (today.getUTCDay() + 2) % 7;
      const latestFri = new Date(today);
      latestFri.setUTCDate(today.getUTCDate() - daysToFri);

      return (data.twoYearsTrades ?? []).map((t) => {
        const slug = normalizeName(t.name);
        const code = `NYFI:${slug}`;
        const trend = t.trend ?? [];
        const history = trend.map((v, i) => {
          const d = new Date(latestFri);
          d.setUTCDate(latestFri.getUTCDate() - (trend.length - 1 - i) * 7);
          return { date: d.toISOString().split("T")[0], value: v };
        });
        return {
          code,
          slug,
          nameKo: LANE_KO[slug] ?? slug,
          value: t.value,
          wow: t.wow,
          absoluteWow: t.absoluteWow,
          containerType: t.containerType ?? null,
          weekDate: history[history.length - 1]?.date ?? "",
          history,
        };
      });
    } catch (error) {
      console.error("NYFI fetch error:", error);
      return [];
    }
  },
);
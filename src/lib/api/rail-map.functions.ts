import { createServerFn } from "@tanstack/react-start";

import { supabasePublicServer } from "@/integrations/supabase/public.server";

type RailStatus = "normal" | "watch" | "delayed" | "severe" | "unknown";

type RailCorridorRow = {
  corridor_code: string;
  name: string;
  origin_area: string;
  destination_area: string;
  railroad: string;
  geometry: {
    type: "LineString";
    coordinates: [number, number][];
  };
};

type RailCorridorStatusRow = {
  corridor_code: string;
  status: RailStatus | null;
  score: number | null;
  reason: string | null;
  source: string | null;
  updated_at: string | null;
};

export type RailCorridorFeature = {
  type: "Feature";
  properties: {
    corridor_code: string;
    name: string;
    railroad: string;
    origin: string;
    destination: string;
    status: RailStatus;
    score: number | null;
    reason: string;
    source: string;
    updated_at: string | null;
  };
  geometry: RailCorridorRow["geometry"];
};

export type RailCorridorsGeoJSON = {
  type: "FeatureCollection";
  features: RailCorridorFeature[];
};

type SupabaseReader = {
  from: (table: string) => {
    select: (columns: string) => {
      order: (column: string, options?: { ascending?: boolean }) => Promise<{
        data: unknown[] | null;
        error: unknown;
      }>;
    };
  };
};

function asErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return JSON.stringify(error);
}

export const getRailCorridorsGeoJSON = createServerFn({ method: "GET" }).handler(
  async (): Promise<RailCorridorsGeoJSON> => {
    const supabase = supabasePublicServer as unknown as SupabaseReader;

    const [{ data: corridors, error: corridorError }, { data: statuses, error: statusError }] = await Promise.all([
      supabase.from("rail_corridors").select("*").order("corridor_code", { ascending: true }),
      supabase.from("rail_corridor_status").select("*").order("corridor_code", { ascending: true }),
    ]);

    if (corridorError) throw new Error(`rail_corridors read failed: ${asErrorMessage(corridorError)}`);
    if (statusError) throw new Error(`rail_corridor_status read failed: ${asErrorMessage(statusError)}`);

    const statusMap = new Map(
      ((statuses ?? []) as RailCorridorStatusRow[]).map((status) => [status.corridor_code, status]),
    );

    return {
      type: "FeatureCollection",
      features: ((corridors ?? []) as RailCorridorRow[]).map((corridor) => {
        const status = statusMap.get(corridor.corridor_code);
        return {
          type: "Feature",
          properties: {
            corridor_code: corridor.corridor_code,
            name: corridor.name,
            railroad: corridor.railroad,
            origin: corridor.origin_area,
            destination: corridor.destination_area,
            status: status?.status ?? "unknown",
            score: status?.score ?? null,
            reason: status?.reason ?? "",
            source: status?.source ?? "",
            updated_at: status?.updated_at ?? null,
          },
          geometry: corridor.geometry,
        };
      }),
    };
  },
);

import { createServerFn } from "@tanstack/react-start";
import { supabasePublicServer } from "@/integrations/supabase/public.server";

export type TcrSnapshotRow = {
  snapshot_date: string;
  total: number | null;
  in_transit: number | null;
  arrived: number | null;
  alert_count: number | null;
  by_destination: Record<string, unknown> | null;
  by_segment: Record<string, unknown> | null;
};

// tcr_snapshots is a global aggregate — no lane_id, used for StatusStrip counts only
export const getTcrSnapshots = createServerFn({ method: "GET" }).handler(
  async (): Promise<TcrSnapshotRow[]> => {
    const { data, error } = await supabasePublicServer
      .from("tcr_snapshots")
      .select("snapshot_date,total,in_transit,arrived,alert_count,by_destination,by_segment")
      .order("snapshot_date", { ascending: false })
      .limit(30);
    if (error) throw new Error(error.message);
    return (data ?? []) as TcrSnapshotRow[];
  },
);

// MTL Link → logisight corridor stats sync
// Calls MTL Link's /api/tcr?action=corridor-stats
// and upserts the result into delay_index_weekly + tcr_snapshots.
//
// Usage from admin UI: call triggerMtlLinkSync() (createServerFn)
// Usage from CLI: MTL_LINK_URL=... MTL_LINK_API_KEY=... npx tsx scripts/sync-mtl-link.ts

import { createServerFn } from "@tanstack/react-start"
import { supabaseAdmin } from "@/integrations/supabase/client.server"

const MTL_LINK_BASE    = (process.env.MTL_LINK_URL    ?? "https://link.mtlship.com").replace(/\/$/, "")
const MTL_LINK_API_KEY = process.env.MTL_LINK_API_KEY ?? ""

type WeeklyStat = {
  lane_id:        string
  week_iso:       string
  milestone:      string
  sample_count:   number
  median_delay_h: number | null
  p90_delay_h:    number | null
  on_time_rate:   number | null
  data_quality:   string
}

type CorridorResponse = {
  ok:          boolean
  computed_at: string
  snapshot: {
    total:          number
    in_transit:     number
    arrived:        number
    alert_count:    number
    by_destination: Record<string, number>
    by_segment:     Record<string, number>
  }
  weekly_stats: WeeklyStat[]
  error?: string
}

export type SyncResult = {
  ok:             boolean
  stats_upserted: number
  snapshot_date:  string
  computed_at?:   string
  error?:         string
}

async function runMtlLinkSync(): Promise<SyncResult> {
  const headers: Record<string, string> = {}
  if (MTL_LINK_API_KEY) headers["Authorization"] = `Bearer ${MTL_LINK_API_KEY}`

  let data: CorridorResponse
  try {
    const res = await fetch(`${MTL_LINK_BASE}/api/tcr?action=corridor-stats`, { headers })
    if (!res.ok) return { ok: false, stats_upserted: 0, snapshot_date: "", error: `HTTP ${res.status}` }
    data = (await res.json()) as CorridorResponse
  } catch (err) {
    return { ok: false, stats_upserted: 0, snapshot_date: "", error: String(err) }
  }

  if (!data.ok) return { ok: false, stats_upserted: 0, snapshot_date: "", error: data.error ?? "ok=false" }

  // Use any-typed client since delay_index_weekly / tcr_snapshots may not be in the generated types
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any

  // Remove stale weekly-format rows (YYYY-Wxx) from the previous schema before upserting monthly rows
  await db
    .from("delay_index_weekly")
    .delete()
    .eq("methodology_version", "mtl-v1")
    .like("week_iso", "%-W%")

  // Upsert monthly delay stats (only rows that have actual delay measurements)
  const statsRows = data.weekly_stats
    .filter((s) => s.median_delay_h !== null)
    .map((s) => ({
      lane_id:             s.lane_id,
      week_iso:            s.week_iso,
      milestone:           s.milestone,
      sample_count:        s.sample_count,
      median_delay_h:      s.median_delay_h,
      p90_delay_h:         s.p90_delay_h,
      on_time_rate:        s.on_time_rate,
      data_quality:        s.data_quality,
      methodology_version: "mtl-v1",
    }))

  if (statsRows.length > 0) {
    const { error: statsErr } = await db
      .from("delay_index_weekly")
      .upsert(statsRows, { onConflict: "lane_id,week_iso,milestone" })
    if (statsErr) return { ok: false, stats_upserted: 0, snapshot_date: "", error: statsErr.message }
  }

  // Upsert today's snapshot
  const snap  = data.snapshot
  const today = new Date().toISOString().split("T")[0]
  const { error: snapErr } = await db
    .from("tcr_snapshots")
    .upsert(
      {
        snapshot_date:  today,
        total:          snap.total,
        in_transit:     snap.in_transit,
        arrived:        snap.arrived,
        alert_count:    snap.alert_count,
        by_destination: snap.by_destination,
        by_segment:     snap.by_segment,
      },
      { onConflict: "snapshot_date" },
    )
  if (snapErr) return { ok: false, stats_upserted: statsRows.length, snapshot_date: today, error: snapErr.message }

  return { ok: true, stats_upserted: statsRows.length, snapshot_date: today, computed_at: data.computed_at }
}

export const triggerMtlLinkSync = createServerFn({ method: "POST" }).handler(runMtlLinkSync)

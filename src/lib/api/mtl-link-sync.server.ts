// MTL Link → logisight corridor stats sync
// Calls MTL Link's TCR and FESCO corridor-stats endpoints
// and upserts results into delay_index_weekly + tcr_snapshots.

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
  snapshot?: {
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
  ok:              boolean
  tcr_upserted:    number
  fesco_upserted:  number
  snapshot_date:   string
  computed_at?:    string
  error?:          string
}

function buildStatRows(stats: WeeklyStat[], methodology: string) {
  return stats
    .filter((s) => s.median_delay_h !== null)
    .map((s) => ({
      lane_id:             s.lane_id,
      week_iso:            s.week_iso,
      milestone:           s.milestone,
      sample_count:        s.sample_count,
      median_delay_h:      s.median_delay_h,
      p90_delay_h:         s.p90_delay_h,
      on_time_rate:        s.on_time_rate,
      otp_pct:             s.on_time_rate != null ? Math.round(s.on_time_rate * 100) : null,
      data_quality:        s.data_quality,
      methodology_version: methodology,
    }))
}

async function runMtlLinkSync(): Promise<SyncResult> {
  const headers: Record<string, string> = {}
  if (MTL_LINK_API_KEY) headers["Authorization"] = `Bearer ${MTL_LINK_API_KEY}`

  const today = new Date().toISOString().split("T")[0]

  // Fetch TCR and FESCO stats in parallel
  const [tcrRes, fescoRes] = await Promise.allSettled([
    fetch(`${MTL_LINK_BASE}/api/tcr?action=corridor-stats`, { headers }),
    fetch(`${MTL_LINK_BASE}/api/tcr?action=fesco-corridor-stats`, { headers }),
  ])

  let tcrData: CorridorResponse | null = null
  let fescoData: CorridorResponse | null = null

  if (tcrRes.status === "fulfilled" && tcrRes.value.ok) {
    tcrData = (await tcrRes.value.json()) as CorridorResponse
    if (!tcrData.ok) tcrData = null
  }
  if (fescoRes.status === "fulfilled" && fescoRes.value.ok) {
    fescoData = (await fescoRes.value.json()) as CorridorResponse
    if (!fescoData.ok) fescoData = null
  }

  if (!tcrData && !fescoData) {
    return { ok: false, tcr_upserted: 0, fesco_upserted: 0, snapshot_date: today, error: "both endpoints failed" }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any

  // Remove stale weekly-format (YYYY-Wxx) rows for both methodology versions
  await Promise.all([
    db.from("delay_index_weekly").delete().eq("methodology_version", "mtl-v1").like("week_iso", "%-W%"),
    db.from("delay_index_weekly").delete().eq("methodology_version", "fesco-mtl-v1").like("week_iso", "%-W%"),
  ])

  let tcrUpserted = 0
  let fescoUpserted = 0

  // Upsert TCR stats
  if (tcrData) {
    const rows = buildStatRows(tcrData.weekly_stats, "mtl-v1")
    if (rows.length > 0) {
      const { error } = await db.from("delay_index_weekly").upsert(rows, { onConflict: "lane_id,week_iso,milestone" })
      if (error) return { ok: false, tcr_upserted: 0, fesco_upserted: 0, snapshot_date: today, error: `TCR upsert: ${error.message}` }
      tcrUpserted = rows.length
    }
  }

  // Upsert FESCO stats
  if (fescoData) {
    const rows = buildStatRows(fescoData.weekly_stats, "fesco-mtl-v1")
    if (rows.length > 0) {
      const { error } = await db.from("delay_index_weekly").upsert(rows, { onConflict: "lane_id,week_iso,milestone" })
      if (error) return { ok: false, tcr_upserted: tcrUpserted, fesco_upserted: 0, snapshot_date: today, error: `FESCO upsert: ${error.message}` }
      fescoUpserted = rows.length
    }
  }

  // Upsert today's TCR snapshot
  if (tcrData?.snapshot) {
    const snap = tcrData.snapshot
    await db.from("tcr_snapshots").upsert(
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
  }

  return {
    ok:             true,
    tcr_upserted:   tcrUpserted,
    fesco_upserted: fescoUpserted,
    snapshot_date:  today,
    computed_at:    tcrData?.computed_at ?? fescoData?.computed_at,
  }
}

export const triggerMtlLinkSync = createServerFn({ method: "POST" }).handler(runMtlLinkSync)

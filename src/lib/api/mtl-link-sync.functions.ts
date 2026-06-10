import { createServerFn } from "@tanstack/react-start";

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
      // otp_pct is a GENERATED ALWAYS column in Postgres — never insert
      data_quality:        s.data_quality,
      methodology_version: methodology,
    }))
}

async function runMtlLinkSync(): Promise<SyncResult> {
  const { default: ws } = await import("ws");
  const { createClient } = await import("@supabase/supabase-js");
  const db = createClient(
    process.env["SUPABASE_URL"]!,
    process.env["SUPABASE_SERVICE_ROLE_KEY"]!,
    { auth: { persistSession: false }, realtime: { transport: ws } },
  );

  const headers: Record<string, string> = {}
  if (MTL_LINK_API_KEY) headers["Authorization"] = `Bearer ${MTL_LINK_API_KEY}`

  const today = new Date().toISOString().split("T")[0]

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

  // Remove ALL stale weekly-format (YYYY-Wxx) rows regardless of methodology version.
  // Old rows may have null or legacy methodology values that a versioned filter would miss.
  await db.from("delay_index_weekly").delete().like("week_iso", "%-W%")

  let tcrUpserted = 0
  let fescoUpserted = 0

  if (tcrData) {
    const rows = buildStatRows(tcrData.weekly_stats, "mtl-v1")
    if (rows.length > 0) {
      const { error } = await db.from("delay_index_weekly").upsert(rows, { onConflict: "lane_id,week_iso,milestone" })
      if (error) return { ok: false, tcr_upserted: 0, fesco_upserted: 0, snapshot_date: today, error: `TCR upsert: ${error.message}` }
      tcrUpserted = rows.length
    }
  }

  if (fescoData) {
    const rows = buildStatRows(fescoData.weekly_stats, "fesco-mtl-v1")
    if (rows.length > 0) {
      const { error } = await db.from("delay_index_weekly").upsert(rows, { onConflict: "lane_id,week_iso,milestone" })
      if (error) return { ok: false, tcr_upserted: tcrUpserted, fesco_upserted: 0, snapshot_date: today, error: `FESCO upsert: ${error.message}` }
      fescoUpserted = rows.length
    }
  }

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

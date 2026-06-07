import { createServerFn } from "@tanstack/react-start";
import { supabasePublicServer } from "@/integrations/supabase/public.server";
import { computeOceanPressureSignal, type FreightIndexPoint } from "@/server/signals";
import type { AlertCandidate } from "@/server/alerts";

const SEVERITY_RANK: Record<string, number> = { high: 4, medium: 3, low: 2, info: 1 };

function classify(
  key: string,
  severity: "high" | "medium" | "low" | "info",
  prevMap: Map<string, string>,
): AlertCandidate["status"] {
  const prev = prevMap.get(key);
  if (!prev) return "new";
  return SEVERITY_RANK[severity] > (SEVERITY_RANK[prev] ?? 0) ? "escalated" : "unchanged";
}

export const getAlertCandidates = createServerFn({ method: "GET" }).handler(
  async (): Promise<AlertCandidate[]> => {
    const today = new Date().toISOString().slice(0, 10);
    const prevDay = new Date(Date.now() - 86400000 * 2).toISOString().slice(0, 10);

    // 1. KCCI history → ocean pressure signal
    // 최신 60주를 가져온다(내림차순+limit). 과거 오름차순+limit은 가장 오래된 60행을
    // 집어 기준일·3주평균·변화율이 전부 stale(2024년)이 되는 버그였음. 신호 내부에서 다시 오름차순 정렬.
    const { data: kcciData } = await supabasePublicServer
      .from("freight_indices")
      .select("index_code,value,change_pct,week_date")
      .eq("index_code", "KCCI")
      .order("week_date", { ascending: false })
      .limit(60);
    const kcciSeries = (kcciData ?? []) as FreightIndexPoint[];
    const oceanSig = computeOceanPressureSignal(kcciSeries);

    // 2. Active eurasia disruptions
    const { data: disruptions } = await supabasePublicServer
      .from("eurasia_disruptions")
      .select("id,lane_id,title,severity,delay_contribution_days,created_at")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(20);

    // 3. Policies effective within D+30
    const d30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    const { data: policies } = await supabasePublicServer
      .from("policies")
      .select("id,title_ko,severity,effective_date,status")
      .eq("status", "active")
      .not("effective_date", "is", null)
      .lte("effective_date", d30)
      .gte("effective_date", today)
      .order("effective_date", { ascending: true })
      .limit(10);

    // 4. Previous snapshots for status comparison
    const { data: snapshots } = await supabasePublicServer
      .from("alert_snapshots")
      .select("source_table,source_id,severity")
      .eq("snapshot_date", prevDay)
      .limit(100);
    const prevMap = new Map<string, string>(
      (snapshots ?? []).map((s) => [`${s.source_table}:${s.source_id}`, s.severity as string]),
    );

    const candidates: AlertCandidate[] = [];

    // Ocean signal
    if (oceanSig && (oceanSig.state === "caution" || oceanSig.state === "alert")) {
      const key = "freight_indices:KCCI:pressure";
      const sev = oceanSig.state === "alert" ? "high" : "medium";
      candidates.push({
        key,
        severity: sev,
        status: classify(key, sev, prevMap),
        title: "한국발 해상 운임 압력",
        sub: oceanSig.basis,
        source: "rates",
        deepLink: "/rates",
        asOf: oceanSig.asOf,
      });
    }

    // Eurasia disruptions
    for (const d of disruptions ?? []) {
      const key = `eurasia_disruptions:${d.id}`;
      const sev = (d.severity ?? "low") as "high" | "medium" | "low";
      candidates.push({
        key,
        severity: sev,
        status: classify(key, sev, prevMap),
        title: d.title,
        sub: d.delay_contribution_days !== null ? `${d.delay_contribution_days}일 기여 추정` : "지연 기여 미산출",
        source: "eurasia",
        deepLink: "/eurasia",
        asOf: d.created_at?.slice(0, 10) ?? null,
      });
    }

    // Policies
    for (const p of policies ?? []) {
      if (!p.effective_date) continue;
      const daysUntil = Math.round((new Date(p.effective_date).getTime() - Date.now()) / 86400000);
      const key = `policies:${p.id}`;
      const sev = ((p.severity as string) ?? "info") as "high" | "medium" | "low" | "info";
      candidates.push({
        key,
        severity: sev,
        status: classify(key, sev, prevMap),
        title: p.title_ko,
        sub: `시행 D−${daysUntil}`,
        source: "policy",
        deepLink: "/policy",
        asOf: today,
      });
    }

    // Upsert today's snapshots (fire-and-forget)
    const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
    if (serviceKey && candidates.length > 0) {
      const { createClient } = await import("@supabase/supabase-js");
      const svc = createClient(process.env["SUPABASE_URL"]!, serviceKey);
      void svc.from("alert_snapshots").upsert(
        candidates.map((c) => {
          const parts = c.key.split(":");
          return {
            snapshot_date: today,
            source_table: parts[0] ?? "unknown",
            source_id: parts.slice(1).join(":") || c.key,
            severity: c.severity,
            category: c.source,
            title_ko: c.title,
            resolved: false,
          };
        }),
      );
    }

    // Return top 5 sorted by severity
    return candidates
      .sort((a, b) => (SEVERITY_RANK[b.severity] ?? 0) - (SEVERITY_RANK[a.severity] ?? 0))
      .slice(0, 5);
  },
);

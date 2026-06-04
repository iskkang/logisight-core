type Severity = "high" | "medium" | "low" | "info";

export type AlertCandidate = {
  key: string;
  severity: "high" | "medium" | "low" | "info";
  status: "new" | "escalated" | "unchanged";
  title: string;
  sub: string;
  source: "rates" | "eurasia" | "policy";
  deepLink: string;
  asOf: string | null;
};

export type AlertRow = {
  id: string;
  snapshot_date: string;
  source_table: string;
  source_id: string;
  severity: Severity;
  category: string;
  title_ko: string;
  detail_ko: string | null;
  resolved: boolean;
  created_at: string;
};

type PrevSnapshot = Pick<AlertRow, "source_table" | "source_id" | "severity">;

const SEVERITY_RANK: Record<Severity, number> = {
  high: 4,
  medium: 3,
  low: 2,
  info: 1,
};

export function classifyAlertStatus(
  current: Pick<AlertRow, "source_table" | "source_id" | "severity">,
  previous: PrevSnapshot[],
): "new" | "escalated" | "unchanged" | "resolved" {
  const prev = previous.find(
    (p) => p.source_table === current.source_table && p.source_id === current.source_id,
  );
  if (!prev) return "new";
  const prevRank = SEVERITY_RANK[prev.severity];
  const curRank = SEVERITY_RANK[current.severity];
  if (curRank > prevRank) return "escalated";
  return "unchanged";
}

export function selectTopAlerts(alerts: AlertRow[], limit = 5): AlertRow[] {
  const seen = new Set<string>();
  const deduped: AlertRow[] = [];

  for (const alert of alerts) {
    const key = `${alert.source_table}:${alert.source_id}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(alert);
    }
  }

  return deduped
    .filter((a) => !a.resolved)
    .sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity])
    .slice(0, limit);
}

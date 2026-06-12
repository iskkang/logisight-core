import { createServerFn } from "@tanstack/react-start";

import { supabasePublicServer } from "@/integrations/supabase/public.server";
import { getFescoServer } from "@/integrations/supabase/fesco.server";
import type {
  OperationalCurrentDelay,
  OperationalDelayResult,
  SourceState,
  SourceStatus,
} from "./operational-delay";

// 두 프로젝트의 집계 뷰 컬럼(동일 shape). 원본 컨테이너 행은 절대 select하지 않는다.
const VIEW_COLS =
  "source_system,transport_mode,route_family,route_label,current_from,current_to,origin,destination,location_name,segment_type,container_count,active_delayed_count,max_delay_days,median_delay_days,p90_delay_days,alert_delay_days,original_expected_arrival_date,current_eta,last_checked_at,data_quality,source_table";

type ViewRow = Record<string, unknown>;
const num = (v: unknown): number | undefined => (v == null ? undefined : Number(v));
const str = (v: unknown): string | undefined => (v == null ? undefined : String(v));

function normalize(rows: ViewRow[]): OperationalCurrentDelay[] {
  return (rows ?? [])
    .filter((r) => r && r.source_system) // stub(where false) 행은 source_system이 null → 제외
    .map((r) => ({
      id: `${r.source_system}:${r.current_from ?? "?"}→${r.current_to ?? "?"}`,
      source_system: r.source_system as OperationalCurrentDelay["source_system"],
      transport_mode: (r.transport_mode ?? "UNKNOWN") as OperationalCurrentDelay["transport_mode"],
      route_family: r.route_family as OperationalCurrentDelay["route_family"],
      container_count: Number(r.container_count ?? 0),
      active_delayed_count: Number(r.active_delayed_count ?? 0),
      current_from: str(r.current_from),
      current_to: str(r.current_to),
      origin: str(r.origin),
      destination: str(r.destination),
      route_label: str(r.route_label) ?? `${r.current_from ?? "?"} → ${r.current_to ?? "?"}`,
      location_name: str(r.location_name),
      segment_type: r.segment_type as OperationalCurrentDelay["segment_type"],
      max_delay_days: num(r.max_delay_days),
      median_delay_days: num(r.median_delay_days),
      p90_delay_days: num(r.p90_delay_days),
      alert_delay_days: num(r.alert_delay_days),
      original_expected_arrival_date: str(r.original_expected_arrival_date),
      current_eta: str(r.current_eta),
      last_checked_at: str(r.last_checked_at),
      data_quality: (r.data_quality ?? "indicative") as OperationalCurrentDelay["data_quality"],
      source_table: str(r.source_table) ?? "",
    }));
}

// 에러 메시지로 '뷰 미생성' vs 일반 오류 구분.
function classify(message: string): SourceState {
  return /schema cache|does not exist|could not find/i.test(message) ? "view_missing" : "error";
}

// FESCO(zidk…) + TCR(hmg…) 집계 뷰 → 정규화 union + 소스별 상태(미생성/0행/정상)를 함께 반환.
// 소스를 조용히 생략하지 않는다 — UI가 상태를 명시한다.
export const getOperationalCurrentDelay = createServerFn({ method: "GET" }).handler(
  async (): Promise<OperationalDelayResult> => {
    const records: OperationalCurrentDelay[] = [];
    const sources: SourceStatus[] = [];

    // FESCO
    const fesco = getFescoServer();
    if (!fesco) {
      sources.push({ source_system: "FESCO", state: "view_missing", rows: 0, message: "FESCO env 미설정" });
    } else {
      const { data, error } = await fesco.from("fesco_delay_current_snapshot").select(VIEW_COLS);
      if (error) sources.push({ source_system: "FESCO", state: classify(error.message), rows: 0, message: error.message });
      else {
        const norm = normalize(data as ViewRow[]);
        records.push(...norm);
        sources.push({ source_system: "FESCO", state: norm.length ? "active" : "empty", rows: norm.length });
      }
    }

    // TCR
    const hmg = supabasePublicServer as unknown as {
      from: (t: string) => { select: (c: string) => Promise<{ data: ViewRow[] | null; error: { message: string } | null }> };
    };
    const { data: tcr, error: tcrErr } = await hmg.from("tcr_delay_current_snapshot").select(VIEW_COLS);
    if (tcrErr) sources.push({ source_system: "TCR", state: classify(tcrErr.message), rows: 0, message: tcrErr.message });
    else {
      const norm = normalize(tcr ?? []);
      records.push(...norm);
      sources.push({ source_system: "TCR", state: norm.length ? "active" : "empty", rows: norm.length });
    }

    return { records, sources };
  },
);

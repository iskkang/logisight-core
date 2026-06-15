import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import {
  extractRateSheet,
  uploadRateImage,
  saveRateSheet,
  type ExtractedSheet,
} from "@/lib/api/partner-rates.functions";
import { kitaDestsQueryOptions } from "@/lib/api/partner-rates";

export const Route = createFileRoute("/admin/partner-rates")({
  head: () => ({
    meta: [
      { title: "실측 운임 업로드 — Logisight Admin" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AdminPartnerRates,
});

type EditRow = ExtractedSheet["rows"][number] & { kita_dest: string | null };

function AdminPartnerRates() {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const { data: dests = [] } = useQuery(kitaDestsQueryOptions());
  const [busy, setBusy] = useState(false);
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [sheet, setSheet] = useState<ExtractedSheet["sheet"] | null>(null);
  const [rows, setRows] = useState<EditRow[]>([]);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) navigate({ to: "/admin/login" });
      else setSession(data.session);
    });
  }, [navigate]);

  async function onFile(file: File) {
    setBusy(true); setMsg("추출 중…");
    try {
      // 네이티브 base64 변환(대용량 캡처에서 문자열 concat 2차 비용 회피)
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      const ext: "png" | "jpg" | "webp" = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
      const media: "image/png" | "image/jpeg" | "image/webp" = file.type === "image/png" ? "image/png" : file.type === "image/webp" ? "image/webp" : "image/jpeg";
      const up = await uploadRateImage({ data: { imageBase64: base64, ext } });
      setImagePath(up.path);
      const ex = await extractRateSheet({ data: { imageBase64: base64, mediaType: media } });
      setSheet(ex.sheet);
      setRows(ex.rows.map((r) => ({ ...r, kita_dest: null })));
      setMsg(`추출 완료: ${ex.rows.length}행. 확인·보정 후 저장하세요.`);
    } catch (e) { setMsg("실패: " + (e as Error).message); }
    finally { setBusy(false); }
  }

  async function save(status: "draft" | "published") {
    if (!sheet) return;
    setBusy(true); setMsg("저장 중…");
    try {
      const res = await saveRateSheet({ data: {
        sheet: { ...sheet, valid_from: null, image_path: imagePath, status },
        rows,
      } });
      setMsg(`저장됨 (${status}): ${res.rows}행`);
      setSheet(null); setRows([]); setImagePath(null);
    } catch (e) { setMsg("저장 실패: " + (e as Error).message); }
    finally { setBusy(false); }
  }

  function setRow(i: number, patch: Partial<EditRow>) {
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  if (!session) return null;

  return (
    <main style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      <h1>실측 운임 업로드</h1>
      <input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy}
        onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
      <p>{msg}</p>

      {sheet && (
        <>
          <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(4,1fr)", margin: "12px 0" }}>
            <label>출처<input value={sheet.source ?? ""} onChange={(e) => setSheet({ ...sheet, source: e.target.value })} /></label>
            <label>제목<input value={sheet.title ?? ""} onChange={(e) => setSheet({ ...sheet, title: e.target.value })} /></label>
            <label>유효기간<input value={sheet.valid_until ?? ""} placeholder="YYYY-MM-DD" onChange={(e) => setSheet({ ...sheet, valid_until: e.target.value })} /></label>
            <label>각주<input value={sheet.notes ?? ""} onChange={(e) => setSheet({ ...sheet, notes: e.target.value })} /></label>
          </div>
          <table border={1} cellPadding={4} style={{ borderCollapse: "collapse", fontSize: 12, width: "100%" }}>
            <thead><tr>
              <th>POL</th><th>POD</th><th>국가</th><th>20'</th><th>40'/HQ</th><th>Transit</th><th>Route</th><th>Carrier</th><th>비고</th><th>KITA 항만 매핑</th>
            </tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td><input value={r.pol ?? ""} onChange={(e) => setRow(i, { pol: e.target.value })} /></td>
                  <td><input value={r.pod ?? ""} onChange={(e) => setRow(i, { pod: e.target.value })} /></td>
                  <td><input value={r.country ?? ""} onChange={(e) => setRow(i, { country: e.target.value })} /></td>
                  <td><input value={r.rate_20 ?? ""} onChange={(e) => setRow(i, { rate_20: e.target.value })} /></td>
                  <td><input value={r.rate_40 ?? ""} onChange={(e) => setRow(i, { rate_40: e.target.value })} /></td>
                  <td><input value={r.transit ?? ""} onChange={(e) => setRow(i, { transit: e.target.value })} /></td>
                  <td><input value={r.route_type ?? ""} onChange={(e) => setRow(i, { route_type: e.target.value })} /></td>
                  <td><input value={r.carrier ?? ""} onChange={(e) => setRow(i, { carrier: e.target.value })} /></td>
                  <td><input value={r.remark ?? ""} onChange={(e) => setRow(i, { remark: e.target.value })} /></td>
                  <td>
                    <select value={r.kita_dest ?? ""} onChange={(e) => setRow(i, { kita_dest: e.target.value || null })}>
                      <option value="">(미매핑)</option>
                      {dests.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
            <button disabled={busy} onClick={() => save("draft")}>임시저장(draft)</button>
            <button disabled={busy} onClick={() => save("published")}>발행(published)</button>
          </div>
        </>
      )}
    </main>
  );
}

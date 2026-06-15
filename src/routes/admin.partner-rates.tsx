import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import {
  extractRateSheet,
  uploadRateImage,
  saveRateSheet,
  getRateSheetImageUrl,
  deleteRateSheet,
  type ExtractedSheet,
} from "@/lib/api/partner-rates.functions";
import { kitaDestsQueryOptions, rateSheetsHistoryQueryOptions } from "@/lib/api/partner-rates";

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
  const qc = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const { data: dests = [] } = useQuery(kitaDestsQueryOptions());
  const { data: history = [] } = useQuery(rateSheetsHistoryQueryOptions());
  const [busy, setBusy] = useState(false);
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [sheet, setSheet] = useState<ExtractedSheet["sheet"] | null>(null);
  const [rows, setRows] = useState<EditRow[]>([]);
  const [msg, setMsg] = useState("");
  const [picked, setPicked] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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
      setSheet(null); setRows([]); setImagePath(null); setPicked(null);
      if (fileRef.current) fileRef.current.value = "";
      qc.invalidateQueries({ queryKey: ["rate_sheets", "history"] });
    } catch (e) { setMsg("저장 실패: " + (e as Error).message); }
    finally { setBusy(false); }
  }

  function setRow(i: number, patch: Partial<EditRow>) {
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  async function openPreview(path: string | null) {
    if (!path) { setMsg("이미지 경로가 없습니다."); return; }
    try {
      const { url } = await getRateSheetImageUrl({ data: { path } });
      setPreviewUrl(url);
    } catch (e) { setMsg("미리보기 실패: " + (e as Error).message); }
  }

  async function onDelete(id: string, image_path: string | null) {
    if (!window.confirm("이 업로드를 삭제할까요? (행·이미지 모두 삭제)")) return;
    setBusy(true);
    try {
      await deleteRateSheet({ data: { id, image_path } });
      setMsg("삭제됨.");
      qc.invalidateQueries({ queryKey: ["rate_sheets", "history"] });
    } catch (e) { setMsg("삭제 실패: " + (e as Error).message); }
    finally { setBusy(false); }
  }

  if (!session) return null;

  return (
    <main style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      <h1>실측 운임 업로드</h1>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          style={{ display: "none" }}
          onChange={(e) => setPicked(e.target.files?.[0] ?? null)}
        />
        <button type="button" disabled={busy} onClick={() => fileRef.current?.click()}>찾기</button>
        <span style={{ fontSize: 13, color: "#555" }}>{picked ? picked.name : "선택된 파일 없음"}</span>
        <button type="button" disabled={busy || !picked} onClick={() => picked && onFile(picked)}>업로드</button>
      </div>
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

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 18 }}>업로드 이력</h2>
        {history.length === 0 ? (
          <p style={{ color: "#888", fontSize: 13 }}>업로드된 운임표가 없습니다.</p>
        ) : (
          <table border={1} cellPadding={6} style={{ borderCollapse: "collapse", fontSize: 13, width: "100%" }}>
            <thead><tr>
              <th>업로드일</th><th>출처</th><th>제목</th><th>유효기간</th><th>상태</th><th>행수</th><th>미리보기</th><th>삭제</th>
            </tr></thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id}>
                  <td style={{ whiteSpace: "nowrap" }}>{h.created_at?.slice(0, 10)}</td>
                  <td>{h.source ?? "-"}</td>
                  <td>{h.title ?? "-"}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{h.valid_until ?? "-"}</td>
                  <td>{h.status === "published" ? "발행" : "임시"}</td>
                  <td style={{ textAlign: "right" }}>{h.row_count}</td>
                  <td>
                    <button type="button" disabled={!h.image_path} onClick={() => openPreview(h.image_path)}>보기</button>
                  </td>
                  <td>
                    <button type="button" disabled={busy} onClick={() => onDelete(h.id, h.image_path)}>삭제</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {previewUrl && (
        <div
          onClick={() => setPreviewUrl(null)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 24,
          }}
        >
          <img
            src={previewUrl}
            alt="rate sheet preview"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "95%", maxHeight: "95%", objectFit: "contain", background: "#fff" }}
          />
        </div>
      )}
    </main>
  );
}

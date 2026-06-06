import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import { upsertPolicy, type PolicyRow } from "@/lib/api/policies";

export const Route = createFileRoute("/admin/policies")({
  head: () => ({
    meta: [
      { title: "정책 관리 — Logisight Admin" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AdminPoliciesPage,
});

type Draft = {
  id?: string;
  title_ko: string;
  region: string;
  country_code: string;
  policy_type: string;
  effective_date: string;
  expiry_date: string;
  severity: "high" | "medium" | "low" | "info";
  summary_ko: string;
  affected_hs_chapters: string;
  source_url: string;
  last_verified_at: string;
};

const EMPTY_DRAFT: Draft = {
  title_ko: "",
  region: "",
  country_code: "",
  policy_type: "",
  effective_date: "",
  expiry_date: "",
  severity: "medium",
  summary_ko: "",
  affected_hs_chapters: "",
  source_url: "",
  last_verified_at: "",
};

function AdminPoliciesPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [policies, setPolicies] = useState<PolicyRow[]>([]);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) navigate({ to: "/admin/login" });
      else setSession(data.session);
    });
  }, [navigate]);

  useEffect(() => {
    if (!session) return;
    supabase
      .from("policies")
      .select("id,title_ko,country_code,region,policy_type,effective_date,severity,status,last_verified_at,updated_at")
      .order("effective_date", { ascending: true, nullsFirst: false })
      .limit(100)
      .then(({ data }) => setPolicies((data ?? []) as PolicyRow[]));
  }, [session, saving]);

  function toastMsg(text: string) {
    setMsg(text);
    setTimeout(() => setMsg(null), 3500);
  }

  function startEdit(p: PolicyRow) {
    setEditingId(p.id);
    setDraft({
      id: p.id,
      title_ko: p.title_ko,
      region: p.region ?? "",
      country_code: p.country_code ?? "",
      policy_type: p.policy_type,
      effective_date: p.effective_date ?? "",
      expiry_date: (p as PolicyRow & { expiry_date?: string }).expiry_date ?? "",
      severity: p.severity,
      summary_ko: p.summary_ko ?? "",
      affected_hs_chapters: (p.affected_hs_chapters ?? []).join(", "),
      source_url: p.source_url ?? "",
      last_verified_at: p.last_verified_at?.slice(0, 10) ?? "",
    });
  }

  async function handleSave() {
    if (!draft.title_ko || !draft.policy_type) {
      toastMsg("제목과 유형은 필수입니다.");
      return;
    }
    setSaving(true);
    try {
      await upsertPolicy({
        data: {
          ...(draft.id ? { id: draft.id } : {}),
          title_ko: draft.title_ko,
          region: draft.region || null,
          country_code: draft.country_code || null,
          policy_type: draft.policy_type,
          effective_date: draft.effective_date || null,
          severity: draft.severity,
          summary_ko: draft.summary_ko || null,
          affected_hs_chapters: draft.affected_hs_chapters
            ? draft.affected_hs_chapters.split(",").map((s) => s.trim()).filter(Boolean)
            : null,
          source_url: draft.source_url || null,
          last_verified_at: draft.last_verified_at
            ? new Date(draft.last_verified_at).toISOString()
            : null,
        },
      });
      toastMsg(draft.id ? "수정됨" : "저장됨");
      setDraft(EMPTY_DRAFT);
      setEditingId(null);
    } catch (e) {
      toastMsg(`오류: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  function markVerifiedToday() {
    setDraft((d) => ({ ...d, last_verified_at: new Date().toISOString().slice(0, 10) }));
  }

  if (!session) return null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 lg:px-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold">정책 관리</h1>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <a href="/admin/forecasts" className="hover:underline">전망 검수 →</a>
          <a href="/admin/routes" className="hover:underline">← 노선 관리</a>
        </div>
      </div>

      {/* Form */}
      <div className="mb-8 rounded-lg border border-border bg-card p-5">
        <h2 className="mb-4 text-sm font-semibold">
          {editingId ? "정책 수정" : "정책 추가"}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="text-[11px] text-muted-foreground">제목 *</label>
            <input
              value={draft.title_ko}
              onChange={(e) => setDraft((d) => ({ ...d, title_ko: e.target.value }))}
              placeholder="예: EU CBAM 시행 (2026)"
              className="mt-0.5 w-full rounded border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
            />
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground">유형 *</label>
            <input
              value={draft.policy_type}
              onChange={(e) => setDraft((d) => ({ ...d, policy_type: e.target.value }))}
              placeholder="예: 환경규제, 관세, 제재, 안전기준"
              className="mt-0.5 w-full rounded border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
            />
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground">심각도</label>
            <select
              value={draft.severity}
              onChange={(e) => setDraft((d) => ({ ...d, severity: e.target.value as Draft["severity"] }))}
              className="mt-0.5 w-full rounded border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
            >
              <option value="high">높음</option>
              <option value="medium">중간</option>
              <option value="low">낮음</option>
              <option value="info">정보</option>
            </select>
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground">지역</label>
            <input
              value={draft.region}
              onChange={(e) => setDraft((d) => ({ ...d, region: e.target.value }))}
              placeholder="예: EU, 미국, 중국"
              className="mt-0.5 w-full rounded border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
            />
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground">국가 코드</label>
            <input
              value={draft.country_code}
              onChange={(e) => setDraft((d) => ({ ...d, country_code: e.target.value.toUpperCase() }))}
              placeholder="예: DE, US, CN"
              maxLength={3}
              className="mt-0.5 w-full rounded border border-border bg-background px-3 py-2 text-sm font-mono outline-none focus:border-ring"
            />
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground">시행일</label>
            <input
              type="date"
              value={draft.effective_date}
              onChange={(e) => setDraft((d) => ({ ...d, effective_date: e.target.value }))}
              className="mt-0.5 w-full rounded border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
            />
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground">만료일</label>
            <input
              type="date"
              value={draft.expiry_date}
              onChange={(e) => setDraft((d) => ({ ...d, expiry_date: e.target.value }))}
              className="mt-0.5 w-full rounded border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-[11px] text-muted-foreground">요약 (한국어)</label>
            <textarea
              value={draft.summary_ko}
              onChange={(e) => setDraft((d) => ({ ...d, summary_ko: e.target.value }))}
              rows={3}
              placeholder="정책 변경 내용 요약"
              className="mt-0.5 w-full rounded border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring resize-none"
            />
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground">영향 HS 챕터 (쉼표 구분)</label>
            <input
              value={draft.affected_hs_chapters}
              onChange={(e) => setDraft((d) => ({ ...d, affected_hs_chapters: e.target.value }))}
              placeholder="예: 85, 87, 72"
              className="mt-0.5 w-full rounded border border-border bg-background px-3 py-2 text-sm font-mono outline-none focus:border-ring"
            />
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground">공식 출처 URL</label>
            <input
              type="url"
              value={draft.source_url}
              onChange={(e) => setDraft((d) => ({ ...d, source_url: e.target.value }))}
              placeholder="https://..."
              className="mt-0.5 w-full rounded border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
            />
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground">최종 검증일</label>
            <div className="flex gap-2 mt-0.5">
              <input
                type="date"
                value={draft.last_verified_at}
                onChange={(e) => setDraft((d) => ({ ...d, last_verified_at: e.target.value }))}
                className="flex-1 rounded border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
              />
              <button
                type="button"
                onClick={markVerifiedToday}
                className="rounded border border-border px-2 py-1.5 text-xs hover:bg-muted whitespace-nowrap"
              >
                오늘로 확인
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {saving ? "저장 중…" : editingId ? "수정 저장" : "추가"}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={() => { setDraft(EMPTY_DRAFT); setEditingId(null); }}
              className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted"
            >
              취소
            </button>
          )}
          {msg && <span className="text-sm text-muted-foreground">{msg}</span>}
        </div>
      </div>

      {/* Policy list */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">제목</th>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">유형</th>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">지역</th>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">시행일</th>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">검증</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {policies.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  정책 없음 — 위 폼에서 추가하세요
                </td>
              </tr>
            ) : (
              policies.map((p) => (
                <tr key={p.id} className="border-b border-border/60 last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium">{p.title_ko}</span>
                      {!p.last_verified_at && (
                        <span className="rounded bg-status-caution/10 px-1 py-0.5 text-[10px] text-status-caution">
                          검증 전
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{p.policy_type}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {[p.region, p.country_code].filter(Boolean).join(" · ") || "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{p.effective_date ?? "—"}</td>
                  <td className="px-4 py-3 text-xs">
                    {p.last_verified_at ? (
                      p.last_verified_at.slice(0, 10)
                    ) : (
                      <span className="text-status-caution">미확인</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => startEdit(p)}
                      className="text-xs text-muted-foreground hover:text-foreground underline"
                    >
                      수정
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

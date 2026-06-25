import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import {
  saveForecastDraft,
  publishForecast,
  resolveForecast,
  annotateForecast,
  needsRetrospective,
  MODULE_LABEL,
  type Forecast,
  type ForecastModule,
  type ForecastOutcome,
} from "@/lib/api/forecasts";
import { displayLabelOf } from "@/components/forecasts/forecastUtils";

export const Route = createFileRoute("/admin/forecasts")({
  head: () => ({
    meta: [
      { title: "전망 검수 — Logisight Admin" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AdminForecastsPage,
});

// "*" so scoring columns (direction/composite/factor_scores/…) load when present and the
// query never 400s before the scoring migration is applied.
const SELECT = "*";

type Draft = {
  id?: string;
  module: ForecastModule;
  statement: string;
  basis: string; // one per line
  impact_note: string;
  horizon_date: string;
  confidence: "high" | "medium" | "low";
  invalidation_condition: string;
  metric_ref: string;
};

const EMPTY_DRAFT: Draft = {
  module: "rates",
  statement: "",
  basis: "",
  impact_note: "",
  horizon_date: "",
  confidence: "medium",
  invalidation_condition: "",
  metric_ref: "",
};

const CONF_LABEL: Record<string, string> = { high: "높음", medium: "중간", low: "낮음" };
const OUTCOME_LABEL: Record<ForecastOutcome, string> = { hit: "적중", partial: "부분", miss: "빗나감" };
const OUTCOME_CLS: Record<ForecastOutcome, string> = {
  hit: "bg-status-normal/10 text-status-normal",
  partial: "bg-status-caution/10 text-status-caution",
  miss: "bg-status-alert/10 text-status-alert",
};

function AdminForecastsPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [rows, setRows] = useState<Forecast[]>([]);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  // resolve inline form
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<ForecastOutcome>("hit");
  const [outcomeNote, setOutcomeNote] = useState("");

  // 복기(annotate) inline form — 자동 판정된 miss/partial에 사후 복기 작성
  const [annotatingId, setAnnotatingId] = useState<string | null>(null);
  const [annotateNote, setAnnotateNote] = useState("");

  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) navigate({ to: "/admin/login" });
      else setSession(data.session);
    });
  }, [navigate]);

  useEffect(() => {
    if (!session) return;
    supabase
      .from("forecasts")
      .select(SELECT)
      // 운임 전망 검수 화면 — climate(기후 영향 초안)는 별도 파이프라인 소관이라 제외(모듈 혼입 방지).
      .in("module", ["rates", "eurasia", "trade", "policy"])
      .order("created_at", { ascending: false })
      .limit(200)
      .then(({ data }) => setRows((data ?? []) as Forecast[]));
  }, [session, tick]);

  function toast(text: string) {
    setMsg(text);
    setTimeout(() => setMsg(null), 3500);
  }
  const refresh = () => setTick((t) => t + 1);

  function startEdit(f: Forecast) {
    setEditingId(f.id);
    setDraft({
      id: f.id,
      module: f.module,
      statement: f.statement,
      basis: (f.basis ?? []).join("\n"),
      impact_note: f.impact_note ?? "",
      horizon_date: f.horizon_date ?? "",
      confidence: f.confidence ?? "medium",
      invalidation_condition: f.invalidation_condition ?? "",
      metric_ref: f.metric_ref ?? "",
    });
    // 편집 폼은 페이지 상단에 있음 — 클릭 즉시 폼으로 스크롤해 편집 위치를 보여준다.
    requestAnimationFrame(() =>
      editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  }

  async function handleSave() {
    if (!draft.statement.trim()) {
      toast("전망 본문은 필수입니다.");
      return;
    }
    setSaving(true);
    try {
      await saveForecastDraft({
        data: {
          ...(draft.id ? { id: draft.id } : {}),
          module: draft.module,
          statement: draft.statement.trim(),
          basis: draft.basis
            ? draft.basis.split("\n").map((s) => s.trim()).filter(Boolean)
            : null,
          impact_note: draft.impact_note || null,
          horizon_date: draft.horizon_date || null,
          confidence: draft.confidence,
          invalidation_condition: draft.invalidation_condition || null,
          metric_ref: draft.metric_ref || null,
        },
      });
      toast(draft.id ? "초안 수정됨" : "초안 저장됨");
      setDraft(EMPTY_DRAFT);
      setEditingId(null);
      refresh();
    } catch (e) {
      toast(`오류: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish(id: string) {
    if (!confirm("발행하면 본문은 수정·삭제할 수 없습니다 (무효 조건만 예외). 발행할까요?")) return;
    try {
      await publishForecast({ data: { id } });
      toast("발행됨");
      refresh();
    } catch (e) {
      toast(`오류: ${(e as Error).message}`);
    }
  }

  async function handleAnnotate(id: string) {
    if (!annotateNote.trim()) {
      toast("복기 내용을 입력하세요.");
      return;
    }
    try {
      await annotateForecast({ data: { id, outcome_note: annotateNote.trim() } });
      toast("복기 저장됨");
      setAnnotatingId(null);
      setAnnotateNote("");
      refresh();
    } catch (e) {
      toast(`오류: ${(e as Error).message}`);
    }
  }

  async function handleResolve(id: string) {
    if (outcome !== "hit" && !outcomeNote.trim()) {
      toast("빗나감·부분 판정에는 복기가 필수입니다.");
      return;
    }
    try {
      await resolveForecast({ data: { id, outcome, outcome_note: outcomeNote || null } });
      toast("판정 확정");
      setResolvingId(null);
      setOutcomeNote("");
      setOutcome("hit");
      refresh();
    } catch (e) {
      toast(`오류: ${(e as Error).message}`);
    }
  }

  if (!session) return null;

  const drafts = rows.filter((r) => r.status === "draft");
  const published = rows.filter((r) => r.status === "published");
  const resolved = rows.filter((r) => r.status === "resolved");

  const inputCls =
    "mt-0.5 w-full rounded border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring";

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 lg:px-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold">전망 검수 큐</h1>
        <a href="/admin/policies" className="text-sm text-muted-foreground hover:underline">
          정책 관리 →
        </a>
      </div>

      {/* Draft editor */}
      <div
        ref={editorRef}
        className={`mb-8 rounded-lg border bg-card p-5 transition-shadow ${
          editingId ? "border-ring ring-2 ring-ring/40" : "border-border"
        }`}
      >
        <h2 className="mb-4 text-sm font-semibold">
          {editingId ? "초안 수정" : "초안 추가"}{" "}
          <span className="rounded bg-status-observe/10 px-1.5 py-0.5 text-[11px] text-status-observe">
            AI 초안 · 에디터 검수
          </span>
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-[11px] text-muted-foreground">모듈</label>
            <select
              value={draft.module}
              onChange={(e) => setDraft((d) => ({ ...d, module: e.target.value as ForecastModule }))}
              className={inputCls}
            >
              {(["rates", "eurasia", "trade", "policy"] as const).map((m) => (
                <option key={m} value={m}>
                  {MODULE_LABEL[m]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground">확신도</label>
            <select
              value={draft.confidence}
              onChange={(e) => setDraft((d) => ({ ...d, confidence: e.target.value as Draft["confidence"] }))}
              className={inputCls}
            >
              <option value="high">높음</option>
              <option value="medium">중간</option>
              <option value="low">낮음</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="text-[11px] text-muted-foreground">
              전망 본문 * (현상→원인→배경→전망 · 단정 금지·확률 표현)
            </label>
            <textarea
              value={draft.statement}
              onChange={(e) => setDraft((d) => ({ ...d, statement: e.target.value }))}
              rows={4}
              className={`${inputCls} resize-none`}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-[11px] text-muted-foreground">
              화주 영향 (지수 변화 → FEU/kg 비용·리드타임 → 권장 행동 1개)
            </label>
            <textarea
              value={draft.impact_note}
              onChange={(e) => setDraft((d) => ({ ...d, impact_note: e.target.value }))}
              rows={3}
              className={`${inputCls} resize-none`}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-[11px] text-muted-foreground">근거 지표·수치 (한 줄에 하나)</label>
            <textarea
              value={draft.basis}
              onChange={(e) => setDraft((d) => ({ ...d, basis: e.target.value }))}
              rows={2}
              placeholder={"예: SCFI MoM +6.0%\nKCCI 52주 백분위 78%"}
              className={`${inputCls} resize-none`}
            />
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground">판정 기준일 (horizon)</label>
            <input
              type="date"
              value={draft.horizon_date}
              onChange={(e) => setDraft((d) => ({ ...d, horizon_date: e.target.value }))}
              className={inputCls}
            />
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground">판정용 지표 참조 (metric_ref)</label>
            <input
              value={draft.metric_ref}
              onChange={(e) => setDraft((d) => ({ ...d, metric_ref: e.target.value }))}
              placeholder="예: KCCI / delay_index_weekly:KR-ANDIJAN"
              className={`${inputCls} font-mono`}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-[11px] text-muted-foreground">무효 조건 (예: 해협 재개방)</label>
            <input
              value={draft.invalidation_condition}
              onChange={(e) => setDraft((d) => ({ ...d, invalidation_condition: e.target.value }))}
              className={inputCls}
            />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {saving ? "저장 중…" : editingId ? "수정 저장" : "초안 추가"}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={() => {
                setDraft(EMPTY_DRAFT);
                setEditingId(null);
              }}
              className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted"
            >
              취소
            </button>
          )}
          {msg && <span className="text-sm text-muted-foreground">{msg}</span>}
        </div>
      </div>

      {/* 검수 큐 (draft) */}
      <Section title="검수 큐 (AI 초안)" count={drafts.length}>
        {drafts.map((f) => (
          <div key={f.id} className="rounded-lg border border-border bg-card p-3">
            <ForecastHead f={f} />
            <p className="mt-1.5 whitespace-pre-wrap text-sm">{f.statement}</p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => startEdit(f)}
                className="rounded border border-border px-2.5 py-1 text-xs hover:bg-muted"
              >
                수정
              </button>
              <button
                type="button"
                onClick={() => handlePublish(f.id)}
                className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground"
              >
                발행
              </button>
            </div>
          </div>
        ))}
      </Section>

      {/* 발행됨 — 판정 대기 */}
      <Section title="발행됨 · 판정 대기" count={published.length}>
        {published.map((f) => (
          <div key={f.id} className="rounded-lg border border-border bg-card p-3">
            <ForecastHead f={f} />
            <p className="mt-1.5 whitespace-pre-wrap text-sm">{f.statement}</p>
            {resolvingId === f.id ? (
              <div className="mt-2 space-y-2 rounded border border-border bg-muted/30 p-2.5">
                <div className="flex items-center gap-2">
                  <select
                    value={outcome}
                    onChange={(e) => setOutcome(e.target.value as ForecastOutcome)}
                    className="rounded border border-border bg-background px-2 py-1 text-xs"
                  >
                    <option value="hit">적중</option>
                    <option value="partial">부분</option>
                    <option value="miss">빗나감</option>
                  </select>
                  <span className="text-[11px] text-muted-foreground">
                    빗나감·부분은 복기 필수
                  </span>
                </div>
                <textarea
                  value={outcomeNote}
                  onChange={(e) => setOutcomeNote(e.target.value)}
                  rows={2}
                  placeholder="복기 (outcome_note)"
                  className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs resize-none"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleResolve(f.id)}
                    className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground"
                  >
                    판정 확정
                  </button>
                  <button
                    type="button"
                    onClick={() => setResolvingId(null)}
                    className="rounded border border-border px-2.5 py-1 text-xs hover:bg-muted"
                  >
                    취소
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setResolvingId(f.id);
                  setOutcome("hit");
                  setOutcomeNote("");
                }}
                className="mt-2 rounded border border-border px-2.5 py-1 text-xs hover:bg-muted"
              >
                판정
              </button>
            )}
          </div>
        ))}
      </Section>

      {/* 완료 */}
      <Section title="완료 (판정됨)" count={resolved.length}>
        {resolved.map((f) => (
          <div key={f.id} className="rounded-lg border border-border bg-card p-3">
            <ForecastHead f={f} />
            <p className="mt-1.5 whitespace-pre-wrap text-sm">{f.statement}</p>
            {f.outcome && (
              <div className="mt-1.5 space-y-1.5 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded px-1.5 py-0.5 font-medium ${OUTCOME_CLS[f.outcome]}`}>
                    {OUTCOME_LABEL[f.outcome]}
                  </span>
                  {f.realized_pct != null && (
                    <span className="text-muted-foreground">
                      실측 {f.realized_pct > 0 ? "+" : ""}
                      {f.realized_pct}%
                      {f.expected_range_pct ? ` · 예상 ${f.expected_range_pct}%` : ""}
                    </span>
                  )}
                  {needsRetrospective(f) && (
                    <span className="rounded bg-status-caution/10 px-1.5 py-0.5 font-medium text-status-caution">
                      복기 작성 중
                    </span>
                  )}
                </div>
                {f.outcome_note ? (
                  <p className="text-muted-foreground">복기: {f.outcome_note}</p>
                ) : needsRetrospective(f) ? (
                  annotatingId === f.id ? (
                    <div className="space-y-1.5 rounded border border-border bg-muted/30 p-2">
                      <textarea
                        value={annotateNote}
                        onChange={(e) => setAnnotateNote(e.target.value)}
                        rows={2}
                        placeholder="복기 (outcome_note) — 왜 빗나갔/부분 적중했는지"
                        className="w-full resize-none rounded border border-border bg-background px-2 py-1.5 text-xs"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleAnnotate(f.id)}
                          className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground"
                        >
                          복기 저장
                        </button>
                        <button
                          type="button"
                          onClick={() => setAnnotatingId(null)}
                          className="rounded border border-border px-2.5 py-1 text-xs hover:bg-muted"
                        >
                          취소
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setAnnotatingId(f.id);
                        setAnnotateNote("");
                      }}
                      className="rounded border border-border px-2.5 py-1 text-xs hover:bg-muted"
                    >
                      복기 작성
                    </button>
                  )
                ) : null}
              </div>
            )}
          </div>
        ))}
      </Section>
    </div>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 text-[13px] font-semibold">
        {title} <span className="text-[11px] font-normal text-muted-foreground">{count}건</span>
      </h2>
      {count === 0 ? (
        <p className="text-xs text-muted-foreground">없음</p>
      ) : (
        <div className="space-y-2">{children}</div>
      )}
    </section>
  );
}

const DIR_LABEL: Record<string, string> = { up: "▲ 상승", down: "▼ 하락", flat: "▬ 보합" };

function ForecastHead({ f }: { f: Forecast }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
      <span className="rounded bg-muted px-1.5 py-0.5 font-medium text-foreground/70">
        {MODULE_LABEL[f.module]}
      </span>
      {f.metric_ref && <span className="font-medium text-foreground/80">{displayLabelOf(f)}</span>}
      {f.direction && (
        <span className="rounded bg-status-observe/10 px-1.5 py-0.5 font-medium text-status-observe">
          {DIR_LABEL[f.direction]}
          {f.expected_range_pct ? ` ${f.expected_range_pct}%` : ""}
          {f.composite_score != null
            ? ` · 종합 ${f.composite_score > 0 ? "+" : ""}${f.composite_score}`
            : ""}
        </span>
      )}
      {f.confidence && <span>확신도 {CONF_LABEL[f.confidence]}</span>}
      {f.horizon_date && <span>· 판정일 {f.horizon_date}</span>}
      {f.metric_ref && <span className="font-mono">· {f.metric_ref}</span>}
      {f.data_quality_flags && f.data_quality_flags.length > 0 && (
        <span className="text-muted-foreground/70">· 결측 {f.data_quality_flags.length}</span>
      )}
    </div>
  );
}

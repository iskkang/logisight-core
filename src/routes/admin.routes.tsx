import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import { triggerMtlLinkSync, type SyncResult } from "@/lib/api/mtl-link-sync.server";

export const Route = createFileRoute("/admin/routes")({
  head: () => ({
    meta: [
      { title: "노선 관리 — Logisight Admin" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AdminRoutesPage,
});

type LaneRow = {
  id: string;
  name_en: string;
  name_ko: string | null;
  transit_min: number | null;
  transit_max: number | null;
  is_featured: boolean | null;
  display_order: number | null;
  border_points: string[] | null;
  created_at: string | null;
};

type Draft = {
  name_ko: string;
  transit_min: string;
  transit_max: string;
  is_featured: boolean;
  display_order: string;
  border_points: string;
};

function toDraft(l: LaneRow): Draft {
  return {
    name_ko: l.name_ko ?? "",
    transit_min: l.transit_min == null ? "" : String(l.transit_min),
    transit_max: l.transit_max == null ? "" : String(l.transit_max),
    is_featured: !!l.is_featured,
    display_order: l.display_order == null ? "" : String(l.display_order),
    border_points: (l.border_points ?? []).join(", "),
  };
}

function AdminRoutesPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [lanes, setLanes] = useState<LaneRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);

  // Auth gate
  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      if (!data.session) {
        navigate({ to: "/admin/login", replace: true });
        return;
      }
      setSession(data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (!s) navigate({ to: "/admin/login", replace: true });
      else setSession(s);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [navigate]);

  // Load lanes once authed
  useEffect(() => {
    if (!session) return;
    let active = true;
    (async () => {
      setLoading(true);
      const { data, error: err } = await supabase
        .from("lanes")
        .select(
          "id,name_en,name_ko,transit_min,transit_max,is_featured,display_order,border_points,created_at",
        )
        .order("display_order", { ascending: true, nullsFirst: false })
        .order("id", { ascending: true });
      if (!active) return;
      if (err) {
        setError(err.message);
        setLoading(false);
        return;
      }
      const rows = (data ?? []) as LaneRow[];
      setLanes(rows);
      const d: Record<string, Draft> = {};
      rows.forEach((r) => {
        d[r.id] = toDraft(r);
      });
      setDrafts(d);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [session]);

  const sortedLanes = useMemo(() => lanes, [lanes]);

  function updateDraft(id: string, patch: Partial<Draft>) {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  async function runSync() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const result = await triggerMtlLinkSync();
      setSyncResult(result);
    } catch (err) {
      setSyncResult({ ok: false, stats_upserted: 0, snapshot_date: "", error: String(err) });
    }
    setSyncing(false);
  }

  async function save(id: string) {
    const d = drafts[id];
    if (!d) return;
    setSavingId(id);
    setSavedId(null);
    setError(null);

    const transitMin = d.transit_min === "" ? null : Number(d.transit_min);
    const transitMax = d.transit_max === "" ? null : Number(d.transit_max);
    const displayOrder = d.display_order === "" ? 0 : Number(d.display_order);
    if (
      (transitMin != null && Number.isNaN(transitMin)) ||
      (transitMax != null && Number.isNaN(transitMax)) ||
      Number.isNaN(displayOrder)
    ) {
      setError("숫자 입력값이 올바르지 않습니다.");
      setSavingId(null);
      return;
    }

    const borderPoints = d.border_points
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const { error: err } = await supabase
      .from("lanes")
      .update({
        name_ko: d.name_ko || null,
        transit_min: transitMin,
        transit_max: transitMax,
        is_featured: d.is_featured,
        display_order: displayOrder,
        border_points: borderPoints.length ? borderPoints : null,
      })
      .eq("id", id);

    setSavingId(null);
    if (err) {
      setError(err.message);
      return;
    }
    setSavedId(id);
    // Reflect locally
    setLanes((prev) =>
      prev.map((l) =>
        l.id === id
          ? {
              ...l,
              name_ko: d.name_ko || null,
              transit_min: transitMin,
              transit_max: transitMax,
              is_featured: d.is_featured,
              display_order: displayOrder,
              border_points: borderPoints.length ? borderPoints : null,
            }
          : l,
      ),
    );
    setTimeout(() => setSavedId((cur) => (cur === id ? null : cur)), 1500);
  }

  async function logout() {
    await supabase.auth.signOut();
    navigate({ to: "/admin/login", replace: true });
  }

  if (session === undefined) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 text-sm text-[var(--color-ink-muted)]">
        세션 확인 중…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 lg:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-ink-muted)]">
            Logisight Admin
          </p>
          <h1 className="mt-1 text-2xl font-bold text-[var(--color-ink)]">
            노선 관리
          </h1>
          <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
            로그인: {session?.user.email}
          </p>
        </div>
        <button
          onClick={logout}
          className="rounded-md border border-[var(--color-line)] bg-white px-4 py-2 text-sm font-semibold text-[var(--color-ink)] hover:bg-[var(--color-surface)]"
        >
          로그아웃
        </button>
      </div>

      {/* MTL Link sync */}
      <div className="mt-6 rounded-lg border border-[var(--color-line)] bg-white px-4 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1">
            <p className="text-xs font-semibold text-[var(--color-ink)]">MTL Link → 유라시아 데이터 동기화</p>
            <p className="mt-0.5 text-[11px] text-[var(--color-ink-muted)]">
              MTL Link TCR 회랑 지연 통계를 가져와 delay_index_weekly · tcr_snapshots에 저장합니다.
            </p>
          </div>
          <button
            onClick={runSync}
            disabled={syncing || !session}
            className="rounded-md px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
            style={{ background: "var(--color-navy-900)" }}
          >
            {syncing ? "동기화 중…" : "지금 동기화"}
          </button>
        </div>
        {syncResult && (
          <div
            className={`mt-3 rounded-md px-3 py-2 text-[11px] ${
              syncResult.ok
                ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border border-rose-200 bg-rose-50 text-rose-700"
            }`}
          >
            {syncResult.ok
              ? `완료 — TCR ${(syncResult as any).tcr_upserted ?? syncResult.stats_upserted ?? 0}개 · FESCO ${(syncResult as any).fesco_upserted ?? 0}개 저장, 스냅샷: ${syncResult.snapshot_date}`
              : `오류: ${syncResult.error}`}
          </div>
        )}
      </div>

      {error && (
        <div className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="mt-8 text-sm text-[var(--color-ink-muted)]">
          노선 데이터를 불러오는 중…
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-[var(--color-line)] bg-white">
          <table className="min-w-full divide-y divide-[var(--color-line)] text-sm">
            <thead className="bg-[var(--color-surface)] text-left text-[11px] uppercase tracking-wide text-[var(--color-ink-muted)]">
              <tr>
                <th className="px-3 py-2">ID</th>
                <th className="px-3 py-2">name_en</th>
                <th className="px-3 py-2">name_ko</th>
                <th className="px-3 py-2">transit_min</th>
                <th className="px-3 py-2">transit_max</th>
                <th className="px-3 py-2">featured</th>
                <th className="px-3 py-2">order</th>
                <th className="px-3 py-2">border_points (콤마)</th>
                <th className="px-3 py-2">created_at</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-line)]">
              {sortedLanes.map((l) => {
                const d = drafts[l.id];
                if (!d) return null;
                return (
                  <tr key={l.id} className="align-top">
                    <td className="px-3 py-2 font-mono text-xs text-[var(--color-ink-muted)]">
                      {l.id}
                    </td>
                    <td className="px-3 py-2 text-xs text-[var(--color-ink)]">
                      {l.name_en}
                    </td>
                    <td className="px-3 py-2">
                      <input
                        value={d.name_ko}
                        onChange={(e) =>
                          updateDraft(l.id, { name_ko: e.target.value })
                        }
                        className="w-44 rounded border border-[var(--color-line)] px-2 py-1 text-xs"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={d.transit_min}
                        onChange={(e) =>
                          updateDraft(l.id, { transit_min: e.target.value })
                        }
                        className="w-20 rounded border border-[var(--color-line)] px-2 py-1 text-xs tabular-nums"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={d.transit_max}
                        onChange={(e) =>
                          updateDraft(l.id, { transit_max: e.target.value })
                        }
                        className="w-20 rounded border border-[var(--color-line)] px-2 py-1 text-xs tabular-nums"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={d.is_featured}
                        onChange={(e) =>
                          updateDraft(l.id, { is_featured: e.target.checked })
                        }
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={d.display_order}
                        onChange={(e) =>
                          updateDraft(l.id, { display_order: e.target.value })
                        }
                        className="w-16 rounded border border-[var(--color-line)] px-2 py-1 text-xs tabular-nums"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        value={d.border_points}
                        onChange={(e) =>
                          updateDraft(l.id, { border_points: e.target.value })
                        }
                        placeholder="Khorgos, Brest"
                        className="w-52 rounded border border-[var(--color-line)] px-2 py-1 text-xs"
                      />
                    </td>
                    <td className="px-3 py-2 text-xs text-[var(--color-ink-muted)]">
                      {l.created_at
                        ? new Date(l.created_at).toISOString().slice(0, 10)
                        : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => save(l.id)}
                        disabled={savingId === l.id}
                        className="rounded-md px-3 py-1 text-xs font-semibold text-white disabled:opacity-60"
                        style={{ background: "var(--color-navy-900)" }}
                      >
                        {savingId === l.id
                          ? "저장 중…"
                          : savedId === l.id
                            ? "✓ 저장됨"
                            : "저장"}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {sortedLanes.length === 0 && (
                <tr>
                  <td
                    colSpan={10}
                    className="px-3 py-6 text-center text-sm text-[var(--color-ink-muted)]"
                  >
                    노선 데이터가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
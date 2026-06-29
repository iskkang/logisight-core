import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import {
  listSubscribers,
  setSubscriberStatus,
  deleteSubscriber,
  addSubscriber,
  type Subscriber,
} from "@/lib/api/subscribers.functions";

export const Route = createFileRoute("/admin/subscribers")({
  head: () => ({
    meta: [
      { title: "뉴스레터 구독자 — Logisight Admin" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AdminSubscribersPage,
});

function fmtDate(s: string | null) {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" });
  } catch {
    return s.slice(0, 10);
  }
}

function exportCsv(rows: Subscriber[]) {
  const header = ["email", "name", "company", "status", "source", "subscribed_at", "unsubscribed_at"] as const;
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [
    header.join(","),
    ...rows.map((r) => header.map((h) => esc(r[h])).join(",")),
  ].join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `subscribers-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function AdminSubscribersPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [rows, setRows] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [adding, setAdding] = useState(false);

  const token = session?.access_token ?? "";

  // Auth gate (admin.routes.tsx와 동일 패턴)
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

  async function reload(tok: string) {
    setLoading(true);
    setError(null);
    try {
      const data = await listSubscribers({ data: { token: tok } });
      setRows(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setLoading(false);
  }

  useEffect(() => {
    if (token) void reload(token);
  }, [token]);

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return rows;
    return rows.filter(
      (r) =>
        r.email.toLowerCase().includes(n) ||
        (r.name ?? "").toLowerCase().includes(n) ||
        (r.company ?? "").toLowerCase().includes(n) ||
        (r.source ?? "").toLowerCase().includes(n) ||
        r.status.includes(n),
    );
  }, [rows, q]);

  const activeCount = useMemo(() => rows.filter((r) => r.status === "active").length, [rows]);

  async function toggle(r: Subscriber) {
    setBusyId(r.id);
    setError(null);
    try {
      const next = r.status === "active" ? "unsubscribed" : "active";
      await setSubscriberStatus({ data: { token, id: r.id, status: next } });
      await reload(token);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setBusyId(null);
  }

  async function remove(r: Subscriber) {
    if (!window.confirm(`${r.email} 구독자를 삭제할까요? (되돌릴 수 없습니다)`)) return;
    setBusyId(r.id);
    setError(null);
    try {
      await deleteSubscriber({ data: { token, id: r.id } });
      await reload(token);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setBusyId(null);
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!newEmail.trim()) return;
    setAdding(true);
    setError(null);
    try {
      await addSubscriber({ data: { token, email: newEmail.trim() } });
      setNewEmail("");
      await reload(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
    setAdding(false);
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
    <div className="mx-auto max-w-5xl px-4 py-10 lg:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-ink-muted)]">
            Logisight Admin
          </p>
          <h1 className="mt-1 text-2xl font-bold text-[var(--color-ink)]">뉴스레터 구독자</h1>
          <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
            전체 {rows.length.toLocaleString()}명 · 활성 {activeCount.toLocaleString()}명 · 로그인: {session?.user.email}
          </p>
        </div>
        <button
          onClick={logout}
          className="rounded-md border border-[var(--color-line)] bg-white px-4 py-2 text-sm font-semibold text-[var(--color-ink)] hover:bg-[var(--color-surface)]"
        >
          로그아웃
        </button>
      </div>

      {/* 도구 막대: 검색 · 추가 · CSV */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="이메일·유입경로·상태 검색"
          className="min-w-[200px] flex-1 rounded-md border border-[var(--color-line)] bg-white px-3 py-2 text-sm"
        />
        <form onSubmit={add} className="flex gap-2">
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="수동 추가 이메일"
            className="w-52 rounded-md border border-[var(--color-line)] bg-white px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={adding || !newEmail.trim()}
            className="rounded-md px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: "var(--color-navy-900)" }}
          >
            {adding ? "추가 중…" : "추가"}
          </button>
        </form>
        <button
          onClick={() => exportCsv(filtered)}
          disabled={!filtered.length}
          className="rounded-md border border-[var(--color-line)] bg-white px-3 py-2 text-sm font-semibold text-[var(--color-ink)] hover:bg-[var(--color-surface)] disabled:opacity-50"
        >
          CSV 내보내기
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="mt-8 text-sm text-[var(--color-ink-muted)]">구독자를 불러오는 중…</div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-[var(--color-line)] bg-white">
          <table className="min-w-full divide-y divide-[var(--color-line)] text-sm">
            <thead className="bg-[var(--color-surface)] text-left text-[11px] uppercase tracking-wide text-[var(--color-ink-muted)]">
              <tr>
                <th className="px-3 py-2">이메일</th>
                <th className="px-3 py-2">이름</th>
                <th className="px-3 py-2">회사</th>
                <th className="px-3 py-2">상태</th>
                <th className="px-3 py-2">유입경로</th>
                <th className="px-3 py-2">가입일</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-line)]">
              {filtered.map((r) => (
                <tr key={r.id} className="align-middle">
                  <td className="px-3 py-2 text-[var(--color-ink)]">{r.email}</td>
                  <td className="px-3 py-2 text-[var(--color-ink)]">{r.name ?? "—"}</td>
                  <td className="px-3 py-2 text-xs text-[var(--color-ink-muted)]">{r.company ?? "—"}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-[5px] border px-[7px] py-0.5 text-[10px] font-bold ${
                        r.status === "active"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-ink-muted)]"
                      }`}
                    >
                      {r.status === "active" ? "활성" : "해지"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-[var(--color-ink-muted)]">{r.source ?? "—"}</td>
                  <td className="px-3 py-2 text-xs text-[var(--color-ink-muted)]">{fmtDate(r.subscribed_at)}</td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => toggle(r)}
                        disabled={busyId === r.id}
                        className="rounded-md border border-[var(--color-line)] bg-white px-2.5 py-1 text-xs font-semibold text-[var(--color-ink)] hover:bg-[var(--color-surface)] disabled:opacity-50"
                      >
                        {r.status === "active" ? "수신거부" : "재활성"}
                      </button>
                      <button
                        onClick={() => remove(r)}
                        disabled={busyId === r.id}
                        className="rounded-md border border-rose-200 bg-white px-2.5 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                      >
                        삭제
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-sm text-[var(--color-ink-muted)]">
                    구독자가 없습니다.
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

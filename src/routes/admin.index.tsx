import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";

// /admin 개요 — 관리 도구 목록(카드). 무엇이 있는지 한눈에.
export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "관리 도구 — Logisight Admin" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AdminHome,
});

const TOOLS = [
  { to: "/admin/subscribers", title: "뉴스레터 구독자", desc: "구독자 목록·검색, 수신거부·삭제, 수동 추가, CSV 내보내기" },
  { to: "/admin/routes", title: "노선 관리", desc: "유라시아 노선 메타(운송기간·국경통과점·노출) 편집" },
  { to: "/admin/policies", title: "정책 관리", desc: "무역·통관 정책 알림 등록·수정" },
  { to: "/admin/forecasts", title: "전망 검수", desc: "시장 전망 작성·발행·사후 적중 검증" },
  { to: "/admin/partner-rates", title: "실측 운임 업로드", desc: "협력사 운임표 이미지 추출·검수·발행" },
] as const;

function AdminHome() {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null | undefined>(undefined);

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

  async function logout() {
    await supabase.auth.signOut();
    navigate({ to: "/admin/login", replace: true });
  }

  if (session === undefined) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 text-sm text-[var(--color-ink-muted)]">세션 확인 중…</div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 lg:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-ink)]">관리 도구</h1>
          <p className="mt-1 text-xs text-[var(--color-ink-muted)]">로그인: {session?.user.email}</p>
        </div>
        <button
          onClick={logout}
          className="rounded-md border border-[var(--color-line)] bg-white px-4 py-2 text-sm font-semibold text-[var(--color-ink)] hover:bg-[var(--color-surface)]"
        >
          로그아웃
        </button>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {TOOLS.map((t) => (
          <Link
            key={t.to}
            to={t.to}
            className="group rounded-lg border border-[var(--color-line)] bg-white p-4 transition-colors hover:border-[var(--color-navy-900)]"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-[var(--color-ink)]">{t.title}</h2>
              <span className="text-[var(--color-ink-muted)] transition-colors group-hover:text-[var(--color-navy-900)]">→</span>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-[var(--color-ink-muted)]">{t.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

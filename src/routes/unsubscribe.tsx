import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";

// 뉴스레터 원클릭 수신거부. 이메일 푸터 링크(/unsubscribe?id=<uuid>)로 진입.
// anon 키로 SECURITY DEFINER 함수 newsletter_unsubscribe(p_id)만 호출 — 테이블 직접 접근 없음.
export const Route = createFileRoute("/unsubscribe")({
  validateSearch: (s: Record<string, unknown>) => ({
    id: typeof s.id === "string" ? s.id : "",
  }),
  head: () => ({
    meta: [
      { title: "뉴스레터 구독 해지 — Logisight" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: UnsubscribePage,
});

type State = "loading" | "done" | "already" | "invalid" | "error";

const MESSAGES: Record<State, { title: string; body: string }> = {
  loading: { title: "처리 중…", body: "구독 해지를 처리하고 있습니다." },
  done: { title: "구독이 해지되었습니다", body: "그동안 Logisight 뉴스레터를 이용해 주셔서 감사합니다." },
  already: { title: "이미 해지된 구독입니다", body: "해당 이메일은 이미 수신이 중단된 상태입니다." },
  invalid: { title: "잘못된 링크입니다", body: "구독 정보를 확인할 수 없습니다. 이메일의 수신거부 링크를 다시 눌러 주세요." },
  error: { title: "처리 중 오류가 발생했습니다", body: "잠시 후 다시 시도해 주세요. 계속되면 회신으로 알려 주세요." },
};

function UnsubscribePage() {
  const { id } = Route.useSearch();
  const [state, setState] = useState<State>(id ? "loading" : "invalid");

  useEffect(() => {
    if (!id) return;
    let active = true;
    (async () => {
      const rpc = supabase.rpc as unknown as (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: boolean | null; error: { message: string } | null }>;
      const { data, error } = await rpc("newsletter_unsubscribe", { p_id: id });
      if (!active) return;
      if (error) setState("error");
      else setState(data ? "done" : "already");
    })();
    return () => {
      active = false;
    };
  }, [id]);

  const m = MESSAGES[state];

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-4 py-16 text-center">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-ink-muted)]">
        Logisight 뉴스레터
      </p>
      <h1 className="mt-3 text-2xl font-bold text-[var(--color-ink)]">{m.title}</h1>
      <p className="mt-3 text-sm leading-relaxed text-[var(--color-ink-muted)]">{m.body}</p>
      {state !== "loading" && (
        <Link
          to="/"
          className="mt-8 rounded-md px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: "var(--color-navy-900)" }}
        >
          Logisight 홈으로
        </Link>
      )}
    </div>
  );
}

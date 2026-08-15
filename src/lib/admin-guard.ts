import { redirect } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";

/**
 * /admin/* 라우트 진입 가드 — beforeLoad 에서 부른다.
 *
 * ■ 이건 방어선이 아니라 화면 가드다 ★
 * 진짜 방어는 서버함수의 requireAdmin(lib/api/require-admin.ts)이다. 서버함수는 POST
 * 엔드포인트라 브라우저를 거치지 않고 부를 수 있고, 라우트 가드는 그 경로에 개입하지
 * 못한다. 여기서 하는 일은 "권한 없는 사람이 관리자 화면을 열었을 때 빈 화면과 에러
 * 대신 로그인으로 보내는 것"뿐이다.
 *
 * ■ 왜 서버(SSR)에서는 통과시키는가
 * 이 앱은 세션을 localStorage 에 둔다(integrations/supabase/client.ts — @supabase/ssr
 * 미사용). 서버 렌더 시점에는 볼 세션 자체가 없다. 여기서 막으면 관리자도 첫 로드에서
 * 리다이렉트된다. 그래서 서버에서는 지나가고 클라이언트에서 판정한다.
 *
 * ■ 기존 useEffect 가드와 무엇이 다른가
 * useEffect 는 컴포넌트가 렌더된 뒤에 돈다 —— 그 사이 로더·쿼리가 이미 나간다.
 * beforeLoad 는 그보다 앞이고, 세션 유무가 아니라 admin 역할까지 본다.
 * has_role 은 SECURITY INVOKER 이고 user_roles 에 self-read RLS 가 있어 본인 역할은
 * 로그인 사용자가 직접 조회할 수 있다.
 */
export async function requireAdminRoute() {
  if (typeof window === "undefined") return;

  const { data } = await supabase.auth.getSession();
  const session = data.session;
  if (!session) throw redirect({ to: "/admin/login", replace: true });

  const { data: isAdmin, error } = await supabase.rpc("has_role", {
    _user_id: session.user.id,
    _role: "admin",
  });
  // 검사에 실패한 상태는 "권한 있음"이 아니다.
  if (error || isAdmin !== true) throw redirect({ to: "/admin/login", replace: true });
}

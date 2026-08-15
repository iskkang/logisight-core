import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * 관리자 전용 서버함수의 문지기.
 *
 * ■ 왜 requireUser 로는 부족한가 ★
 * 예전 게이트는 "JWT 가 유효한 로그인 사용자인가"만 봤다(구 subscribers.functions.ts).
 * 그런데 jpn.logisight.net 은 공개 가입이고, 두 사이트가 같은 Supabase 프로젝트를
 * 쓴다(양쪽 supabase/config.toml 의 project_id = hmgbvqczmyjixkqbruzp). 즉 일본판에서
 * 무료 가입한 사람의 토큰이 곧 본판의 유효한 토큰이다. 역할을 안 보면 "가입한 아무나"가
 * 관리자다.
 *
 * ■ 왜 서버에서 봐야 하는가
 * /admin/* 라우트 가드는 브라우저가 렌더한 뒤에야 동작한다. 서버함수는 POST 엔드포인트라
 * 브라우저를 거치지 않고 부를 수 있고, 그 경로에는 라우트 가드가 개입하지 않는다.
 * 게이트는 엔드포인트 안에 있어야 한다.
 *
 * ■ has_role 은 이미 있던 것이다
 * 20260529045350…sql 이 정의해 둔 RPC 인데(SECURITY INVOKER, authenticated·service_role
 * 에 EXECUTE 부여) 애플리케이션 코드에서 부르는 곳이 한 곳도 없었다. RLS 정책들만 쓰고
 * 있었고, 정작 쓰기 경로는 전부 service_role 이라 그 RLS 를 우회했다.
 *
 * 실패는 전부 같은 메시지로 돌려준다 — 토큰이 없는지, 썩었는지, 관리자가 아닌지를
 * 호출자에게 알려줄 이유가 없다.
 */
export async function requireAdmin(token: string) {
  const deny = () => new Error("권한이 없습니다.");
  if (!token) throw deny();

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) throw deny();

  const { data: ok, error: rpcError } = await supabaseAdmin.rpc("has_role", {
    _user_id: data.user.id,
    _role: "admin",
  });
  // RPC 가 실패하면 통과시키지 않는다. 검사할 수 없는 상태는 "권한 있음"이 아니다.
  if (rpcError || ok !== true) throw deny();

  return data.user;
}

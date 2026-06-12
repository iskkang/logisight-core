// 두 번째 Supabase client — FESCO 운영 추적 프로젝트(zidk…) 전용.
// anon(publishable) 키로 '집계 뷰(fesco_delay_current_snapshot)'만 읽는다.
// 원본 컨테이너 테이블(fesco_container_tracking_current)은 읽지 않는다(raw 비노출).
// 별도 프로젝트라 생성된 Database 타입이 없으므로 untyped client로 둔다.
import { createClient } from "@supabase/supabase-js";
import ws from "ws";

function createFescoServerClient() {
  const url = process.env.FESCO_SUPABASE_URL;
  const key = process.env.FESCO_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error("Missing FESCO env: FESCO_SUPABASE_URL / FESCO_SUPABASE_PUBLISHABLE_KEY");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    realtime: { transport: ws },
  });
}

let _client: ReturnType<typeof createFescoServerClient> | undefined;

// env 미설정이면 null — 호출부에서 graceful 처리(FESCO 소스 생략).
export function getFescoServer(): ReturnType<typeof createFescoServerClient> | null {
  if (!process.env.FESCO_SUPABASE_URL || !process.env.FESCO_SUPABASE_PUBLISHABLE_KEY) return null;
  if (!_client) _client = createFescoServerClient();
  return _client;
}

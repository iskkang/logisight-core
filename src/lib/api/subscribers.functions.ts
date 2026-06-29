import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { supabaseAdmin } from "@/integrations/supabase/client.server";

// 뉴스레터 구독자 관리(관리자 전용). 이메일=개인정보이므로 service_role 직접 접근은 서버에서만,
// 모든 함수는 호출자 액세스 토큰을 검증(requireUser)한 뒤 동작 — 비인증 직접 호출 차단.
export type Subscriber = {
  id: string;
  email: string;
  name: string | null;
  company: string | null;
  interests: string[];
  marketing_consent: boolean;
  consent_at: string | null;
  status: string;
  source: string | null;
  subscribed_at: string | null;
  unsubscribed_at: string | null;
};

// Supabase 액세스 토큰(JWT) 검증. 유효한 로그인 사용자만 통과.
async function requireUser(token: string) {
  if (!token) throw new Error("인증이 필요합니다.");
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) throw new Error("권한이 없습니다.");
  return data.user;
}

export const listSubscribers = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string() }).parse(d))
  .handler(async ({ data }): Promise<Subscriber[]> => {
    await requireUser(data.token);
    const { data: rows, error } = await supabaseAdmin
      .from("newsletter_subscribers")
      .select("id,email,name,company,interests,marketing_consent,consent_at,status,source,subscribed_at,unsubscribed_at")
      .order("subscribed_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []) as Subscriber[];
  });

export const setSubscriberStatus = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ token: z.string(), id: z.string(), status: z.enum(["active", "unsubscribed"]) }).parse(d),
  )
  .handler(async ({ data }): Promise<{ ok: true }> => {
    await requireUser(data.token);
    const { error } = await supabaseAdmin
      .from("newsletter_subscribers")
      .update({
        status: data.status,
        unsubscribed_at: data.status === "unsubscribed" ? new Date().toISOString() : null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteSubscriber = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string(), id: z.string() }).parse(d))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    await requireUser(data.token);
    const { error } = await supabaseAdmin.from("newsletter_subscribers").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const addSubscriber = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string(), email: z.string().email() }).parse(d))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    await requireUser(data.token);
    const { error } = await supabaseAdmin
      .from("newsletter_subscribers")
      .upsert(
        { email: data.email.trim(), status: "active", source: "admin", unsubscribed_at: null },
        { onConflict: "email" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

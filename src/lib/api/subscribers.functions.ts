import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireAdmin } from "./require-admin";

// 뉴스레터 구독자 관리(관리자 전용). 이메일=개인정보이므로 service_role 직접 접근은 서버에서만,
// 모든 함수는 호출자가 admin 역할인지 검증(requireAdmin)한 뒤 동작.
//
// 예전에는 requireUser —— "로그인했는가"만 봤다. 일본판이 공개 가입이고 두 사이트가 같은
// Supabase 프로젝트를 쓰므로, 그 게이트는 사실상 열려 있는 것과 같았다. require-admin.ts 참조.
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


export const listSubscribers = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string() }).parse(d))
  .handler(async ({ data }): Promise<Subscriber[]> => {
    await requireAdmin(data.token);
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
    await requireAdmin(data.token);
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
    await requireAdmin(data.token);
    const { error } = await supabaseAdmin.from("newsletter_subscribers").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const addSubscriber = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string(), email: z.string().email() }).parse(d))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    await requireAdmin(data.token);
    const { error } = await supabaseAdmin
      .from("newsletter_subscribers")
      .upsert(
        { email: data.email.trim(), status: "active", source: "admin", unsubscribed_at: null },
        { onConflict: "email" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

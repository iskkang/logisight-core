import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyWebhookSignature } from "@/lib/webhook-signature";

// Resend 웹훅 수신 — 발송·오픈·클릭 이벤트를 email_events에 적재한다.
// 오픈율 측정용. resend.batch.send는 수신자별 개별 메일이라 Resend 대시보드에
// 캠페인 단위 집계가 없다. 회차별 오픈율은 v_newsletter_open_rate 뷰로 본다.
//
// 설정: Resend → Webhooks에서 이 URL을 등록하고 시크릿을 RESEND_WEBHOOK_SECRET에 넣는다.
// Resend → Domains에서 Open Tracking을 켜야 email.opened가 발생한다.

const EVENT_TYPES: Record<string, string> = {
  "email.sent": "sent",
  "email.delivered": "delivered",
  "email.opened": "opened",
  "email.clicked": "clicked",
  "email.bounced": "bounced",
  "email.complained": "complained",
};

export const Route = createFileRoute("/api/webhooks/resend")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.RESEND_WEBHOOK_SECRET;
        if (!secret) {
          // 시크릿 미설정 상태로 요청을 받아들이면 누구나 이벤트를 넣을 수 있다.
          console.error("[resend-webhook] RESEND_WEBHOOK_SECRET 미설정 — 요청 거부");
          return new Response("Not configured", { status: 500 });
        }

        // 서명은 원문 바이트 기준이다. 파싱 후 재직렬화하면 검증이 깨진다.
        const body = await request.text();
        const verified = verifyWebhookSignature({
          id: request.headers.get("svix-id") ?? "",
          timestamp: request.headers.get("svix-timestamp") ?? "",
          signature: request.headers.get("svix-signature") ?? "",
          body,
          secret,
          nowMs: Date.now(),
        });
        if (!verified) return new Response("Invalid signature", { status: 401 });

        let payload: {
          type?: string;
          created_at?: string;
          data?: { email_id?: string; to?: string[]; subject?: string };
        };
        try {
          payload = JSON.parse(body);
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const type = EVENT_TYPES[payload.type ?? ""];
        const emailId = payload.data?.email_id;
        // 관심 없는 이벤트는 200으로 받아 넘긴다 — 4xx를 주면 Resend가 계속 재시도한다.
        if (!type || !emailId) return Response.json({ ok: true, skipped: true });

        const { error } = await supabaseAdmin.from("email_events").upsert(
          {
            email_id: emailId,
            type,
            recipient: payload.data?.to?.[0] ?? null,
            subject: payload.data?.subject ?? null,
            occurred_at: payload.created_at ?? new Date().toISOString(),
          },
          // 오픈은 열 때마다 발생한다. 첫 건만 남겨야 유니크 오픈이 되고,
          // 웹훅 재시도에 대해서도 멱등해진다.
          { onConflict: "email_id,type", ignoreDuplicates: true },
        );
        if (error) {
          // 5xx를 주면 Resend가 재시도하므로 일시적 DB 장애는 복구된다.
          console.error("[resend-webhook] 적재 실패:", error.message);
          return new Response("Insert failed", { status: 500 });
        }

        return Response.json({ ok: true });
      },
    },
  },
});

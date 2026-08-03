import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";

import { verifyWebhookSignature } from "@/lib/webhook-signature";

// Resend는 Svix 규격을 쓴다: 서명 대상 = `${id}.${timestamp}.${body}`,
// 시크릿은 whsec_ 접두어 뒤 base64, 서명 헤더는 "v1,<base64>" 공백 구분 목록.
const SECRET = "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw";
const ID = "msg_2XyZ";
const BODY = JSON.stringify({ type: "email.opened", data: { email_id: "e1" } });
const NOW = 1785700000000; // 고정 기준 시각(ms)
const TS = String(Math.floor(NOW / 1000));

function sign(id: string, ts: string, body: string, secret = SECRET): string {
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  return `v1,${createHmac("sha256", key).update(`${id}.${ts}.${body}`).digest("base64")}`;
}

const ok = {
  id: ID,
  timestamp: TS,
  body: BODY,
  secret: SECRET,
  nowMs: NOW,
};

describe("verifyWebhookSignature", () => {
  it("올바르게 서명된 요청은 통과", () => {
    expect(verifyWebhookSignature({ ...ok, signature: sign(ID, TS, BODY) })).toBe(true);
  });

  it("서명 헤더에 여러 버전이 와도 하나만 맞으면 통과 — 키 로테이션 대응", () => {
    const header = `v1,bm90LWEtcmVhbC1zaWduYXR1cmU= ${sign(ID, TS, BODY)}`;
    expect(verifyWebhookSignature({ ...ok, signature: header })).toBe(true);
  });

  it("본문이 변조되면 거부", () => {
    const tampered = JSON.stringify({ type: "email.opened", data: { email_id: "e999" } });
    expect(verifyWebhookSignature({ ...ok, body: tampered, signature: sign(ID, TS, BODY) })).toBe(
      false,
    );
  });

  it("다른 시크릿으로 서명하면 거부", () => {
    const other = "whsec_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
    expect(verifyWebhookSignature({ ...ok, signature: sign(ID, TS, BODY, other) })).toBe(false);
  });

  it("타임스탬프가 허용 범위를 벗어나면 거부 — 재전송 공격 방지", () => {
    const oldTs = String(Math.floor(NOW / 1000) - 60 * 60);
    expect(
      verifyWebhookSignature({ ...ok, timestamp: oldTs, signature: sign(ID, oldTs, BODY) }),
    ).toBe(false);
  });

  it("미래 타임스탬프도 허용 범위를 벗어나면 거부", () => {
    const futureTs = String(Math.floor(NOW / 1000) + 60 * 60);
    expect(
      verifyWebhookSignature({ ...ok, timestamp: futureTs, signature: sign(ID, futureTs, BODY) }),
    ).toBe(false);
  });

  it("헤더 누락·빈 시크릿은 거부 — 설정 누락 시 열린 엔드포인트가 되면 안 된다", () => {
    expect(verifyWebhookSignature({ ...ok, signature: "" })).toBe(false);
    expect(verifyWebhookSignature({ ...ok, id: "", signature: sign(ID, TS, BODY) })).toBe(false);
    expect(verifyWebhookSignature({ ...ok, secret: "", signature: sign(ID, TS, BODY) })).toBe(
      false,
    );
  });

  it("서명 형식이 깨져도 예외 없이 false", () => {
    expect(verifyWebhookSignature({ ...ok, signature: "garbage" })).toBe(false);
    expect(verifyWebhookSignature({ ...ok, signature: "v1,!!!not-base64!!!" })).toBe(false);
  });
});

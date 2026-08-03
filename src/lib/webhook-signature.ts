// Resend(=Svix) 웹훅 서명 검증.
// 서명 대상: `${svix-id}.${svix-timestamp}.${raw body}`
// 시크릿: whsec_ 접두어 뒤가 base64 키. 서명 헤더: "v1,<base64>" 공백 구분(키 로테이션 시 복수).
//
// svix 패키지를 쓰지 않고 직접 구현했다 — 의존성 하나를 늘리지 않기 위해서다.
// 대신 변조·잘못된 시크릿·재전송·형식 오류를 모두 테스트로 고정했다.
import { createHmac, timingSafeEqual } from "node:crypto";

/** 재전송 공격 허용 오차. Svix 권장값과 동일. */
const TOLERANCE_MS = 5 * 60 * 1000;

export interface WebhookSignatureInput {
  /** svix-id 헤더 */
  id: string;
  /** svix-timestamp 헤더 (초 단위 epoch 문자열) */
  timestamp: string;
  /** svix-signature 헤더 */
  signature: string;
  /** 원문 그대로의 본문. JSON.parse 후 재직렬화하면 서명이 깨진다. */
  body: string;
  /** RESEND_WEBHOOK_SECRET */
  secret: string;
  nowMs: number;
}

export function verifyWebhookSignature(input: WebhookSignatureInput): boolean {
  const { id, timestamp, signature, body, secret, nowMs } = input;
  if (!id || !timestamp || !signature || !secret) return false;

  const sentMs = Number(timestamp) * 1000;
  if (!Number.isFinite(sentMs) || Math.abs(nowMs - sentMs) > TOLERANCE_MS) return false;

  try {
    const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
    if (key.length === 0) return false;
    const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest();

    // 헤더에는 "v1,<sig>"가 공백으로 여러 개 올 수 있다(키 로테이션 중). 하나라도 맞으면 통과.
    return signature.split(" ").some((part) => {
      const [version, value] = part.split(",");
      if (version !== "v1" || !value) return false;
      const actual = Buffer.from(value, "base64");
      return actual.length === expected.length && timingSafeEqual(actual, expected);
    });
  } catch {
    return false;
  }
}

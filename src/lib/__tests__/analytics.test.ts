import { describe, it, expect, afterEach } from "vitest";
import { trackEvent } from "@/lib/analytics";

const g = globalThis as { gtag?: (...args: unknown[]) => void };

afterEach(() => {
  delete g.gtag;
});

describe("trackEvent", () => {
  it("gtag가 있으면 이벤트 이름과 파라미터를 그대로 전달", () => {
    const calls: unknown[][] = [];
    g.gtag = (...args: unknown[]) => calls.push(args);

    trackEvent("sign_up", { method: "newsletter" });

    expect(calls).toEqual([["event", "sign_up", { method: "newsletter" }]]);
  });

  it("파라미터 없이도 전송된다", () => {
    const calls: unknown[][] = [];
    g.gtag = (...args: unknown[]) => calls.push(args);

    trackEvent("newsletter_modal_open");

    expect(calls).toEqual([["event", "newsletter_modal_open", undefined]]);
  });

  // 프리뷰(*.vercel.app)·localhost에는 호스트 가드 때문에 GA 태그 자체가 없다.
  // 여기서 던지면 구독 성공 처리까지 같이 죽는다.
  it("gtag가 없으면 예외 없이 넘어간다", () => {
    expect(() => trackEvent("sign_up")).not.toThrow();
  });
});

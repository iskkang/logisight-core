import { useState } from "react";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";

const emailSchema = z
  .string()
  .trim()
  .min(5)
  .max(254)
  .regex(/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/, {
    message: "올바른 이메일 형식이 아닙니다.",
  });

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

export function NewsletterForm({ compact = false }: { compact?: boolean }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      setStatus({
        kind: "error",
        message: parsed.error.issues[0]?.message ?? "이메일을 확인해 주세요.",
      });
      return;
    }
    setStatus({ kind: "loading" });
    const { error } = await supabase.from("newsletter_subscribers").insert({
      email: parsed.data,
      status: "active",
      source: "footer",
    });
    if (error) {
      const msg = error.message?.toLowerCase() ?? "";
      if (
        msg.includes("duplicate") ||
        msg.includes("unique") ||
        error.code === "23505"
      ) {
        setStatus({
          kind: "error",
          message: "이미 구독 중인 이메일입니다.",
        });
      } else {
        setStatus({
          kind: "error",
          message: "구독에 실패했습니다. 잠시 후 다시 시도해 주세요.",
        });
      }
      return;
    }
    setEmail("");
    setStatus({
      kind: "success",
      message: "구독해 주셔서 감사합니다.",
    });
  }

  return (
    <form onSubmit={onSubmit} className={compact ? "" : "max-w-md"}>
      <div className="flex gap-2">
        <input
          type="email"
          required
          maxLength={254}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          disabled={status.kind === "loading"}
          className="min-w-0 flex-1 rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-[var(--color-cyan)] focus:outline-none disabled:opacity-50"
          aria-label="이메일 주소"
        />
        <button
          type="submit"
          disabled={status.kind === "loading"}
          className="rounded-md px-4 py-2 text-sm font-semibold text-[var(--color-navy-900)] transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ background: "var(--color-cyan)" }}
        >
          {status.kind === "loading" ? "전송 중…" : "구독하기"}
        </button>
      </div>
      {status.kind === "success" && (
        <p className="mt-2 text-xs text-[var(--color-cyan)]">{status.message}</p>
      )}
      {status.kind === "error" && (
        <p className="mt-2 text-xs text-red-300">{status.message}</p>
      )}
      {status.kind === "idle" && (
        <p className="mt-2 text-xs text-white/50">
          주 2~3회 발송되며, 언제든 구독을 해지할 수 있습니다.
        </p>
      )}
    </form>
  );
}
import { useState } from "react";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

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
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [modalEmail, setModalEmail] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  // 인라인 이메일 입력 → "구독하기"는 곧바로 저장하지 않고, 입력값을 들고 팝업을 연다.
  function openModal(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setModalEmail(email);
    setName("");
    setCompany("");
    setStatus({ kind: "idle" });
    setOpen(true);
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const parsed = emailSchema.safeParse(modalEmail);
    if (!parsed.success) {
      setStatus({ kind: "error", message: parsed.error.issues[0]?.message ?? "이메일을 확인해 주세요." });
      return;
    }
    if (!name.trim()) {
      setStatus({ kind: "error", message: "이름을 입력해 주세요." });
      return;
    }
    setStatus({ kind: "loading" });
    const { error } = await supabase.from("newsletter_subscribers").insert({
      email: parsed.data,
      name: name.trim(),
      company: company.trim() || null,
      status: "active",
      source: "popup",
    });
    if (error) {
      const msg = error.message?.toLowerCase() ?? "";
      if (msg.includes("duplicate") || msg.includes("unique") || error.code === "23505") {
        setStatus({ kind: "error", message: "이미 구독 중인 이메일입니다." });
      } else {
        setStatus({ kind: "error", message: "구독에 실패했습니다. 잠시 후 다시 시도해 주세요." });
      }
      return;
    }
    setEmail("");
    setStatus({ kind: "success", message: "구독해 주셔서 감사합니다." });
  }

  const field =
    "mt-1 w-full rounded-md border border-[var(--color-line)] bg-white px-3 py-2 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-ink-muted)] focus:border-[var(--color-cyan)] focus:outline-none";

  return (
    <>
      <form onSubmit={openModal} className={compact ? "" : "max-w-md"}>
        <div className="flex gap-2">
          <input
            type="email"
            required
            maxLength={254}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            className="min-w-0 flex-1 rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-[var(--color-cyan)] focus:outline-none"
            aria-label="이메일 주소"
          />
          <button
            type="submit"
            className="rounded-md px-4 py-2 text-sm font-semibold text-[var(--color-navy-900)] transition-opacity hover:opacity-90"
            style={{ background: "var(--color-cyan)" }}
          >
            구독하기
          </button>
        </div>
        <p className="mt-2 text-xs text-white/50">
          주 2~3회 발송되며, 언제든 구독을 해지할 수 있습니다.
        </p>
      </form>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="text-[var(--color-ink)]">뉴스레터 구독</DialogTitle>
            <DialogDescription className="text-[var(--color-ink-muted)]">
              주 2~3회 물류 인텔리전스 브리핑을 보내드립니다. 이름·회사명을 남겨주시면 더 맞춤화해 드립니다.
            </DialogDescription>
          </DialogHeader>

          {status.kind === "success" ? (
            <div className="py-4 text-center">
              <p className="text-sm font-semibold text-[var(--color-ink)]">{status.message}</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="mt-4 rounded-md px-5 py-2 text-sm font-semibold text-white"
                style={{ background: "var(--color-navy-900)" }}
              >
                닫기
              </button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[var(--color-ink)]">이름 *</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  maxLength={80}
                  placeholder="홍길동"
                  className={field}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--color-ink)]">회사명</label>
                <input
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  maxLength={120}
                  placeholder="(선택) 소속 회사"
                  className={field}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--color-ink)]">이메일 *</label>
                <input
                  type="email"
                  value={modalEmail}
                  onChange={(e) => setModalEmail(e.target.value)}
                  required
                  maxLength={254}
                  placeholder="your@email.com"
                  className={field}
                />
              </div>
              {status.kind === "error" && <p className="text-xs text-rose-600">{status.message}</p>}
              <button
                type="submit"
                disabled={status.kind === "loading"}
                className="w-full rounded-md px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ background: "var(--color-navy-900)" }}
              >
                {status.kind === "loading" ? "구독 중…" : "구독 완료"}
              </button>
              <p className="text-center text-[11px] text-[var(--color-ink-muted)]">
                언제든 수신거부할 수 있습니다.
              </p>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

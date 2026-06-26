import { createFileRoute } from "@tanstack/react-router";

// 유럽 — 준비 중 플레이스홀더(향후 코리도 확장 자리).
export const Route = createFileRoute("/rail/europe")({
  head: () => ({
    meta: [
      { title: "유럽 철도 — 준비 중 — Logisight" },
      { name: "description", content: "유럽 철도 코리도 인텔리전스는 준비 중입니다." },
    ],
  }),
  component: RailEuropePlaceholder,
});

function RailEuropePlaceholder() {
  return (
    <div className="mx-auto w-full max-w-[1240px] px-4 py-20 min-[640px]:px-7">
      <div className="rounded-[14px] border border-[#78a0cd1c] bg-[#0e1626] px-6 py-16 text-center">
        <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#2dd4bf]">Europe Rail</div>
        <h1 className="mt-3 text-[26px] font-extrabold text-[#e9eef7]">유럽 철도 — 준비 중</h1>
        <p className="mx-auto mt-3 max-w-[520px] text-[14px] leading-[1.6] text-[#93a1b7]">
          유럽 철도 코리도(중부유럽·CEE 연계) 인텔리전스는 준비 중입니다. 미주·유라시아 코리도를 먼저 확인하세요.
        </p>
      </div>
    </div>
  );
}

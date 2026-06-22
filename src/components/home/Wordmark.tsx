// src/components/home/Wordmark.tsx
export function Wordmark() {
  return (
    <span className="inline-flex items-center gap-[9px] text-[18px] font-extrabold tracking-[-0.02em]">
      <span
        className="inline-block h-[18px] w-[9px] -skew-x-12 rounded-[2px]"
        style={{ background: "linear-gradient(180deg,#2dd4bf,#0ea5a0)" }}
      />
      <span>
        <span className="text-white">Logi</span>
        <span className="lsg-ls">s</span>
        <span className="text-[#2dd4bf]">ight</span>
      </span>
    </span>
  );
}

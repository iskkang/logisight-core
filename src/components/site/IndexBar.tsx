// Sticky financial-terminal-style index ticker.
// STEP 0: static skeleton with "—" placeholders; STEP 2 wires Supabase data.

type Item = { code: string; label: string; value: string; change?: number | null };

const PLACEHOLDER: Item[] = [
  { code: "SCFI", label: "SCFI", value: "—", change: null },
  { code: "WCI", label: "WCI", value: "—", change: null },
  { code: "FBX", label: "FBX", value: "—", change: null },
  { code: "KCCI", label: "KCCI", value: "—", change: null },
  { code: "CCFI", label: "CCFI", value: "—", change: null },
  { code: "VLSFO", label: "VLSFO", value: "—", change: null },
];

function ChangeChip({ change }: { change: number | null | undefined }) {
  if (change == null) return <span className="text-xs text-[var(--color-ink-muted)]">—</span>;
  const pos = change >= 0;
  return (
    <span
      className="text-xs font-semibold tabular-nums"
      style={{
        color: pos ? "var(--color-success)" : "var(--color-danger)",
      }}
    >
      {pos ? "+" : ""}
      {change.toFixed(2)}%
    </span>
  );
}

export function IndexBar({
  items = PLACEHOLDER,
  updatedLabel,
}: {
  items?: Item[];
  updatedLabel?: string;
}) {
  return (
    <div
      className="sticky top-14 z-40 border-b"
      style={{ background: "#fff", borderColor: "var(--color-line)" }}
    >
      <div className="mx-auto max-w-7xl overflow-x-auto scrollbar-thin">
        <ul className="flex min-w-max items-center gap-6 px-4 py-2 lg:px-6">
          {items.map((it) => (
            <li key={it.code} className="flex items-center gap-2 whitespace-nowrap">
              <span className="text-[11px] uppercase tracking-wide text-[var(--color-ink-muted)]">
                {it.label}
              </span>
              <span className="text-sm font-bold tabular-nums text-[var(--color-ink)]">
                {it.value}
              </span>
              <ChangeChip change={it.change} />
            </li>
          ))}
          <li className="ml-2 whitespace-nowrap text-[11px] text-[var(--color-ink-muted)]">
            {updatedLabel ?? "업데이트: 수집 예정 (주 1회)"}
          </li>
        </ul>
      </div>
    </div>
  );
}
import { Link } from "@tanstack/react-router";

import {
  formatUSD,
  pctChange,
  prevPeriod,
  type TradeProvisionalRow,
} from "@/lib/api/trade";

type Computed = {
  total: number;
  totalMom: number | null;
  priodDt: string | null;
  topCountries: { code: string; name: string; mom: number }[];
};

function compute(rows: TradeProvisionalRow[]): Computed | null {
  if (!rows || rows.length === 0) return null;

  const periods = Array.from(new Set(rows.map((r) => r.period))).sort((a, b) =>
    b.localeCompare(a),
  );
  const latest = periods[0];
  if (!latest) return null;
  const prev = prevPeriod(latest);

  const inLatest = rows.filter(
    (r) => r.period === latest && r.stat_type === "provisional_exp",
  );
  const latestDt =
    inLatest
      .map((r) => r.priod_dt)
      .filter((v): v is string => !!v)
      .sort((a, b) => b.localeCompare(a))[0] ?? null;

  const curr = latestDt
    ? inLatest.filter((r) => r.priod_dt === latestDt)
    : inLatest;

  const allCurr = curr.find((r) => r.country_code === "ALL");
  if (!allCurr || allCurr.export_usd == null) return null;

  const prevRows = rows.filter(
    (r) => r.period === prev && r.stat_type === "provisional_exp",
  );
  const prevDt =
    (latestDt && prevRows.find((r) => r.priod_dt === latestDt)?.priod_dt) ||
    prevRows
      .map((r) => r.priod_dt)
      .filter((v): v is string => !!v)
      .sort((a, b) => b.localeCompare(a))[0] ||
    null;
  const prevCmp = prevDt
    ? prevRows.filter((r) => r.priod_dt === prevDt)
    : prevRows;

  const allPrev = prevCmp.find((r) => r.country_code === "ALL");
  const totalMom = pctChange(allCurr.export_usd, allPrev?.export_usd ?? null);

  const byCountry = curr
    .filter((r) => r.country_code && r.country_code !== "ALL")
    .sort((a, b) => (b.export_usd ?? 0) - (a.export_usd ?? 0))
    .slice(0, 2);

  const prevMap = new Map(
    prevCmp
      .filter((r) => r.country_code && r.country_code !== "ALL")
      .map((r) => [r.country_code!, r.export_usd]),
  );

  const topCountries = byCountry
    .map((r) => {
      const mom = pctChange(r.export_usd, prevMap.get(r.country_code!) ?? null);
      if (mom == null) return null;
      return {
        code: r.country_code!,
        name: r.country_name ?? r.country_code!,
        mom,
      };
    })
    .filter((v): v is { code: string; name: string; mom: number } => v != null);

  return {
    total: allCurr.export_usd,
    totalMom,
    priodDt: latestDt,
    topCountries,
  };
}

function formatDayRange(priodDt: string | null): string {
  if (!priodDt) return "잠정치";
  // priod_dt examples may be YYYYMMDD or YYYY-MM-DD; show "1~DD일"
  const digits = priodDt.replace(/[^0-9]/g, "");
  const dd = digits.slice(-2);
  const d = Number(dd);
  if (!Number.isFinite(d) || d <= 0) return "잠정치";
  return `1~${d}일 기준`;
}

function EmptyCard() {
  return (
    <div className="block rounded-lg border border-dashed border-[var(--color-line)] bg-[var(--color-card)] p-4 shadow-sm">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#0d9488]">
        <span>📦</span>
        <span>이달 수출 현황</span>
      </div>
      <p className="mt-3 text-xs text-[var(--color-ink-muted)]">
        데이터 수집 중입니다
      </p>
      <p className="mt-1 text-[10px] text-[var(--color-ink-muted)]">
        매월 11일부터 잠정치가 표시됩니다.
      </p>
    </div>
  );
}

export function HomeExportWidget({ rows }: { rows: TradeProvisionalRow[] }) {
  const view = compute(rows);
  if (!view) return <EmptyCard />;

  const up = (view.totalMom ?? 0) >= 0;

  return (
    <Link
      to="/trade"
      className="block rounded-lg border border-[var(--color-line)] bg-[var(--color-card)] p-4 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#0d9488]">
        <span>📦</span>
        <span>이달 수출 현황</span>
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-2xl font-black tabular-nums text-[var(--color-heading)]">
          {formatUSD(view.total)}
        </span>
        {view.totalMom != null && (
          <span
            className={
              "text-xs font-semibold tabular-nums " +
              (up ? "text-[#0d9488]" : "text-amber-600")
            }
          >
            {up ? "▲" : "▼"} {Math.abs(view.totalMom).toFixed(1)}%
          </span>
        )}
        <span className="ml-auto text-[10px] text-[var(--color-ink-muted)]">
          {formatDayRange(view.priodDt)}
        </span>
      </div>
      {view.topCountries.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] tabular-nums text-[var(--color-ink-muted)]">
          {view.topCountries.map((c) => {
            const u = c.mom >= 0;
            return (
              <span key={c.code}>
                {c.name}{" "}
                <span
                  className={
                    "font-semibold " + (u ? "text-[#0d9488]" : "text-amber-600")
                  }
                >
                  {u ? "▲" : "▼"}
                  {Math.abs(c.mom).toFixed(0)}%
                </span>
              </span>
            );
          })}
        </div>
      )}
      <div className="mt-3 text-[11px] font-semibold text-[var(--color-navy-600)]">
        → 무역 상세 보기
      </div>
    </Link>
  );
}
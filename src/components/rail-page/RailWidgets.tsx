// 철도 허브 공용 위젯 — ERAI 매크로 위젯 + 뉴스피드(유라시아/유럽 공용). 다크 테마(레일 레이아웃 #070b16).
import { useSuspenseQuery } from "@tanstack/react-query";

import { eraiStatsQueryOptions, ERAI_LABELS } from "@/lib/api/rates";
import { formatPublishedAt, type NewsItem } from "@/lib/api/news";

const WRAP = "mx-auto w-full max-w-[1240px] px-4 min-[640px]:px-7";

function fmtPct(v: number | null | undefined) {
  if (v == null || Number.isNaN(v)) return "—";
  return `${v > 0 ? "+" : ""}${v.toFixed(2)}%`;
}
function fmtVal(v: number | null | undefined) {
  return v == null ? "—" : Math.round(v).toLocaleString();
}

// ERAI 매크로 위젯 — index1520 유라시아 철도 운임 컴포지트(코리도 신호 아님, 대시보드형).
export function EraiWidget() {
  const { data } = useSuspenseQuery(eraiStatsQueryOptions());
  const byCode = Object.fromEntries(data.map((d) => [d.index_code, d]));
  const costCodes = ["ERAI", "ERAI_EAST", "ERAI_WEST"];
  const transit = byCode["ERAI_TRANSIT_DAYS"];
  const asOf = byCode["ERAI"]?.latest_date ?? null;

  return (
    <section className={`${WRAP} pt-7`}>
      <div className="mb-3 flex items-center justify-between gap-2.5">
        <h2 className="text-[18px] font-extrabold tracking-[-0.02em] text-[#e9eef7]">ERAI · 유라시아 철도 운임 지수</h2>
        <span className="rounded-full border border-[#78a0cd1c] bg-[#0e1626] px-2.5 py-1 text-[11px] text-[#93a1b7]">
          index1520 · USD/FEU · {asOf ? asOf.slice(0, 7) : "월별"}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 min-[900px]:grid-cols-4">
        {costCodes.map((code) => {
          const s = byCode[code];
          const up = (s?.change_pct ?? 0) >= 0;
          return (
            <div key={code} className="rounded-[12px] border border-[#78a0cd1c] bg-[#0e1626] px-4 py-[14px]">
              <div className="text-[11.5px] font-medium text-[#93a1b7]">{ERAI_LABELS[code]}</div>
              <div className="mt-[6px] text-[22px] font-extrabold tracking-[-0.02em] text-[#e9eef7]">
                ${fmtVal(s?.latest_value)}
                <span className="ml-1 text-[11px] font-medium text-[#5d6b80]">/FEU</span>
              </div>
              <div className={`mt-[4px] text-[11.5px] ${s?.change_pct == null ? "text-[#5d6b80]" : up ? "text-[#16a34a]" : "text-[#dc2626]"}`}>
                {s?.change_pct == null ? "MoM —" : `${up ? "▲" : "▼"} MoM ${fmtPct(s.change_pct)}`}
              </div>
            </div>
          );
        })}
        <div className="rounded-[12px] border border-[#78a0cd1c] bg-[#0e1626] px-4 py-[14px]">
          <div className="text-[11.5px] font-medium text-[#93a1b7]">{ERAI_LABELS["ERAI_TRANSIT_DAYS"]}</div>
          <div className="mt-[6px] text-[22px] font-extrabold tracking-[-0.02em] text-[#2dd4bf]">
            {transit?.latest_value != null ? transit.latest_value.toFixed(2) : "—"}
            <span className="ml-1 text-[11px] font-medium text-[#5d6b80]">일</span>
          </div>
          <div className="mt-[4px] text-[11.5px] text-[#5d6b80]">철도 운송기간(현재)</div>
        </div>
      </div>
    </section>
  );
}

// 뉴스피드(presentational) — 유라시아/유럽 공용. items는 호출측에서 조회·필터.
export function RailNewsFeed({ title, chip, items, emptyText }: { title: string; chip?: string; items: NewsItem[]; emptyText?: string }) {
  return (
    <section className={`${WRAP} pt-7 pb-10`}>
      <div className="mb-3 flex items-center justify-between gap-2.5">
        <h2 className="text-[18px] font-extrabold tracking-[-0.02em] text-[#e9eef7]">{title}</h2>
        {chip && <span className="rounded-full border border-[#78a0cd1c] bg-[#0e1626] px-2.5 py-1 text-[11px] text-[#93a1b7]">{chip}</span>}
      </div>
      {items.length === 0 ? (
        <div className="rounded-[12px] border border-[#78a0cd1c] bg-[#0e1626] px-5 py-10 text-center text-[13px] text-[#93a1b7]">
          {emptyText ?? "표시할 기사가 없습니다."}
        </div>
      ) : (
        <ul className="divide-y divide-[#78a0cd14] overflow-hidden rounded-[12px] border border-[#78a0cd1c] bg-[#0a0f1d]">
          {items.map((n) => (
            <li key={n.id} className="px-4 py-3.5 transition-colors hover:bg-[#101a2e]">
              <a href={n.url} target="_blank" rel="noopener noreferrer" className="block">
                <div className="text-[14px] font-semibold leading-[1.4] text-[#e9eef7]">{n.title}</div>
                {n.summary && <div className="mt-1 line-clamp-2 text-[12.5px] leading-[1.5] text-[#93a1b7]">{n.summary}</div>}
                <div className="mt-1.5 flex items-center gap-2 text-[11px] text-[#5d6b80]">
                  <span className="font-medium text-[#828d9d]">{n.source}</span>
                  <span>·</span>
                  <span className="lsg-mono">{formatPublishedAt(n.published_at)}</span>
                </div>
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

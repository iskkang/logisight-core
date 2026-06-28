// 유럽 복합운송 터미널 디렉터리 — CIP RNE(RailNetEurope) 공개 데이터. /rail/eurasia '터미널' 탭.
import { useMemo, useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";

import { euRailTerminalsQueryOptions } from "@/lib/api/eu-rail-terminals";
import type { EuRailTerminal } from "@/lib/api/eu-rail-terminals";

// 유형 → 한글 라벨 + 배지 색
const TYPE_META: Record<string, { ko: string; cls: string }> = {
  "Container / Intermodal Terminal": { ko: "컨테이너·복합운송", cls: "border-[#99f6e4] bg-[#f0fdfa] text-[#0d9488]" },
  "Loading / Unloading": { ko: "상·하역", cls: "border-[#bfdbfe] bg-[#eff6ff] text-[#2563eb]" },
  "Marshalling / Shunting Yard": { ko: "조차장", cls: "border-[#fed7aa] bg-[#fff7ed] text-[#d97706]" },
};
const typeKo = (t: string | null) => (t ? TYPE_META[t]?.ko ?? t : "—");
const typeCls = (t: string | null) => (t ? TYPE_META[t]?.cls ?? "border-[#e5e7eb] bg-[#f3f4f6] text-[#6b7280]" : "border-[#e5e7eb] bg-[#f3f4f6] text-[#6b7280]");

const STEP = 120;

export function EuRailTerminals() {
  const { data: terminals } = useSuspenseQuery(euRailTerminalsQueryOptions());
  const [q, setQ] = useState("");
  const [type, setType] = useState("all");
  const [corridor, setCorridor] = useState("all");
  const [limit, setLimit] = useState(STEP);

  const types = useMemo(
    () => [...new Set(terminals.map((t) => t.type).filter((x): x is string => !!x))].sort(),
    [terminals],
  );
  const corridors = useMemo(
    () => [...new Set(terminals.flatMap((t) => t.corridors))].sort(),
    [terminals],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return terminals.filter((t) => {
      if (type !== "all" && t.type !== type) return false;
      if (corridor !== "all" && !t.corridors.includes(corridor)) return false;
      if (!needle) return true;
      return (
        t.name.toLowerCase().includes(needle) ||
        (t.operator ?? "").toLowerCase().includes(needle) ||
        (t.address ?? "").toLowerCase().includes(needle)
      );
    });
  }, [terminals, q, type, corridor]);

  const shown = filtered.slice(0, limit);
  const onFilter = <T,>(set: (v: T) => void) => (v: T) => { set(v); setLimit(STEP); };

  const selCls =
    "rounded-[8px] border border-[#d8dfe9] bg-white px-2.5 py-1.5 text-[12.5px] text-[#1a2433] focus:outline-none focus:ring-1 focus:ring-[#2dd4bf]";

  return (
    <section className="mt-4">
      <div className="mb-3 flex items-center justify-between gap-2.5">
        <h2 className="text-[19px] font-extrabold tracking-[-0.02em] text-[#1a2433]">유럽 복합운송 터미널</h2>
        <span className="rounded-full border border-[#d8dfe9] bg-[#eef1f6] px-[9px] py-[3px] text-[11px] text-[#828d9d]">
          {terminals.length.toLocaleString()}개
        </span>
      </div>

      {/* 필터 */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => onFilter(setQ)(e.target.value)}
          placeholder="터미널·운영사·주소 검색"
          className={`${selCls} min-w-[200px] flex-1`}
        />
        <select value={type} onChange={(e) => onFilter(setType)(e.target.value)} className={selCls}>
          <option value="all">모든 유형</option>
          {types.map((t) => (
            <option key={t} value={t}>{typeKo(t)}</option>
          ))}
        </select>
        <select value={corridor} onChange={(e) => onFilter(setCorridor)(e.target.value)} className={selCls}>
          <option value="all">모든 회랑</option>
          {corridors.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      <div className="mb-2 text-[12px] text-[#828d9d]">{filtered.length.toLocaleString()}개 결과</div>

      {/* 목록 */}
      <div className="divide-y divide-[#e6ebf2] overflow-hidden rounded-[14px] border border-[#d8dfe9] bg-white">
        {shown.map((t) => (
          <TerminalRow key={t.id} t={t} />
        ))}
        {!shown.length && (
          <div className="px-4 py-8 text-center text-[13px] text-[#828d9d]">조건에 맞는 터미널이 없습니다.</div>
        )}
      </div>

      {filtered.length > limit && (
        <div className="mt-3 text-center">
          <button
            type="button"
            onClick={() => setLimit((n) => n + STEP)}
            className="rounded-[8px] border border-[#d8dfe9] bg-white px-4 py-2 text-[12.5px] font-semibold text-[#54606f] transition-colors hover:bg-[#f4f7fb]"
          >
            더 보기 ({(filtered.length - limit).toLocaleString()})
          </button>
        </div>
      )}

      <div className="mt-4 text-[11px] text-[#828d9d]">
        데이터 출처: CIP — RailNetEurope Customer Information Platform ·{" "}
        <a className="text-[#54606f] underline" href="https://cip.rne.eu/topology/interactive-map" target="_blank" rel="noopener noreferrer">cip.rne.eu</a>
      </div>
    </section>
  );
}

function TerminalRow({ t }: { t: EuRailTerminal }) {
  return (
    <div className="flex flex-col gap-1.5 px-4 py-3 md:flex-row md:items-center md:justify-between md:gap-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[14px] font-bold text-[#1a2433]">{t.name}</span>
          <span className={`flex-none rounded-[5px] border px-[7px] py-0.5 text-[10px] font-bold ${typeCls(t.type)}`}>
            {typeKo(t.type)}
          </span>
        </div>
        {t.operator && <div className="mt-0.5 truncate text-[12.5px] text-[#54606f]">{t.operator}</div>}
        {t.address && <div className="mt-0.5 truncate text-[11.5px] text-[#828d9d]">{t.address}</div>}
      </div>
      <div className="flex flex-none flex-col gap-1 md:items-end">
        {t.corridors.length > 0 && (
          <div className="flex flex-wrap gap-1 md:justify-end">
            {t.corridors.map((c) => (
              <span key={c} className="rounded-[5px] bg-[#eef1f6] px-[6px] py-0.5 text-[10px] text-[#5d6b80]">{c}</span>
            ))}
          </div>
        )}
        {t.homePage && (
          <a
            className="text-[11.5px] font-semibold text-[#0d9488] underline"
            href={t.homePage}
            target="_blank"
            rel="noopener noreferrer"
          >
            홈페이지 ↗
          </a>
        )}
      </div>
    </div>
  );
}

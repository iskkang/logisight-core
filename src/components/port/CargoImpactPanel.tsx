// 내 화물 영향 분석 — 기존 /policy 의 policies 기반 도구를 포트 리디자인에서 보존.
// HS 챕터·지역으로 DB 리스크 이벤트를 필터해 점검 체크리스트를 만든다. (추정·임의 수치 없음, DB 기준)
import { useMemo, useState } from "react";

import { DetailDrawer } from "@/components/dashboard/DetailDrawer";
import { policiesQueryOptions, type PolicyRow } from "@/lib/api/policies";
import { useSuspenseQuery } from "@tanstack/react-query";

const CARD = "rounded-[14px] border border-[#d8dfe9] bg-[#f4f7fb] shadow-[0_1px_2px_rgba(16,24,40,0.04)]";

const SEV_LABEL: Record<string, string> = { high: "높음", medium: "중간", low: "낮음", info: "정보" };
const SEV_TONE: Record<string, string> = {
  high: "text-[#b42318] bg-[#fef0ef] border-[#fdd3cf]",
  medium: "text-[#b54708] bg-[#fff7ed] border-[#fed7aa]",
  low: "text-[#067647] bg-[#ecfdf3] border-[#c7ead6]",
  info: "text-[#54606f] bg-[#eef2f7] border-[#d8dfe9]",
};
const SEV_RANK: Record<string, number> = { high: 4, medium: 3, low: 2, info: 1 };

function daysUntil(dateStr: string): number {
  return Math.round((new Date(dateStr).getTime() - Date.now()) / 86400000);
}
function chapterPrefix(s: string): string {
  return s.replace(/\D/g, "").slice(0, 2);
}
function parseChapters(input: string): Set<string> {
  const set = new Set<string>();
  for (const tok of input.split(/[,\s]+/)) {
    const p = chapterPrefix(tok);
    if (p) set.add(p);
  }
  return set;
}

function SevBadge({ sev }: { sev: PolicyRow["severity"] | null }) {
  if (!sev) return <span className="text-[#828d9d]">—</span>;
  return (
    <span className={`rounded-[5px] border px-[7px] py-0.5 text-[10.5px] font-bold ${SEV_TONE[sev] ?? SEV_TONE.info}`}>
      {SEV_LABEL[sev]}
    </span>
  );
}

function PolicyChecklist({
  items, checkedIds, onToggle, onSelect,
}: {
  items: PolicyRow[];
  checkedIds: Set<string>;
  onToggle: (id: string) => void;
  onSelect: (p: PolicyRow) => void;
}) {
  return (
    <ul className="space-y-1.5">
      {items.map((p) => {
        const d = p.effective_date ? daysUntil(p.effective_date) : null;
        const checked = checkedIds.has(p.id);
        return (
          <li key={p.id} className="flex items-start gap-2.5 rounded-[10px] border border-[#d8dfe9] bg-white px-3 py-2">
            <button
              type="button" role="checkbox" aria-checked={checked}
              aria-label={`${p.title_ko} 점검 완료 표시`}
              onClick={() => onToggle(p.id)}
              className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] leading-none ${checked ? "border-[#0d9488] bg-[#0d9488]/15 text-[#0d9488]" : "border-[#d8dfe9] text-transparent"}`}
            >✓</button>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button" onClick={() => onSelect(p)}
                  className={`text-left text-[13.5px] font-medium hover:underline ${checked ? "text-[#828d9d] line-through" : "text-[#1a2433]"}`}
                >{p.title_ko}</button>
                <SevBadge sev={p.severity} />
                {d !== null && d >= 0 && (
                  <span suppressHydrationWarning className={`rounded px-1 py-0.5 text-[10px] font-medium ${d <= 30 ? "bg-[#fef0ef] text-[#b42318]" : "bg-[#fff7ed] text-[#b54708]"}`}>D−{d}</span>
                )}
                {!p.last_verified_at && <span className="rounded bg-[#fff7ed] px-1 py-0.5 text-[10px] text-[#b54708]">검증 전</span>}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-[#828d9d]">
                <span>{[p.region, p.country_code].filter(Boolean).join(" · ") || p.policy_type}</span>
                {p.effective_date && <span>발효 {p.effective_date}</span>}
                {p.affected_hs_chapters && p.affected_hs_chapters.length > 0 && <span>HS {p.affected_hs_chapters.slice(0, 4).join(", ")}</span>}
                {p.source_url && <a href={p.source_url} target="_blank" rel="noopener noreferrer" className="text-[#0d9488] underline">출처↗</a>}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function PolicyDetail({ policy }: { policy: PolicyRow }) {
  const d = policy.effective_date ? daysUntil(policy.effective_date) : null;
  return (
    <div className="space-y-5">
      {!policy.last_verified_at && (
        <div className="rounded bg-[#fff7ed] px-3 py-2 text-[11px] font-medium text-[#b54708]">검증 전 — last_verified_at 미입력. 내용을 확인 후 어드민에서 갱신하세요.</div>
      )}
      {policy.summary_ko && (
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[#828d9d]">변경 내용 요약</p>
          <p className="text-sm leading-relaxed">{policy.summary_ko}</p>
        </div>
      )}
      <div className="grid grid-cols-2 gap-y-2 text-xs">
        <span className="text-[#828d9d]">유형</span><span>{policy.policy_type}</span>
        <span className="text-[#828d9d]">지역·국가</span><span>{[policy.region, policy.country_code].filter(Boolean).join(" · ") || "—"}</span>
        <span className="text-[#828d9d]">심각도</span><span><SevBadge sev={policy.severity} /></span>
        <span className="text-[#828d9d]">발효일</span><span>{policy.effective_date ?? "—"}{d !== null && d >= 0 && <span className="ml-1.5 text-[#828d9d]">(D−{d})</span>}</span>
        <span className="text-[#828d9d]">만료일</span><span>{policy.expiry_date ?? "—"}</span>
        <span className="text-[#828d9d]">영향 HS 챕터</span><span>{policy.affected_hs_chapters?.join(", ") || "—"}</span>
        <span className="text-[#828d9d]">최종 검증</span><span className={policy.last_verified_at ? "" : "text-[#b54708]"}>{policy.last_verified_at?.slice(0, 10) ?? "검증 전"}</span>
      </div>
      {policy.source_url && (
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[#828d9d]">출처</p>
          <a href={policy.source_url} target="_blank" rel="noopener noreferrer" className="break-all text-xs text-[#0d9488] underline">{policy.source_url}</a>
        </div>
      )}
    </div>
  );
}

export function CargoImpactPanel() {
  const { data: policies } = useSuspenseQuery(policiesQueryOptions());
  const [hsInput, setHsInput] = useState("");
  const [regionInput, setRegionInput] = useState("");
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<PolicyRow | null>(null);

  const toggleChecked = (id: string) =>
    setCheckedIds((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const impactChapters = useMemo(() => parseChapters(hsInput), [hsInput]);
  const regionQuery = regionInput.trim().toLowerCase();
  const matches = useMemo(() => {
    if (impactChapters.size === 0 && !regionQuery) return null;
    return policies
      .filter((p) => {
        const hsOk = impactChapters.size === 0 || (p.affected_hs_chapters ?? []).some((c) => impactChapters.has(chapterPrefix(c)));
        const regionOk = !regionQuery || [p.region, p.country_code].filter((x): x is string => Boolean(x)).some((x) => x.toLowerCase().includes(regionQuery));
        return hsOk && regionOk;
      })
      .sort((a, b) => (SEV_RANK[b.severity] ?? 0) - (SEV_RANK[a.severity] ?? 0));
  }, [policies, impactChapters, regionQuery]);

  return (
    <section className={`mt-[18px] space-y-3 p-[22px] ${CARD}`}>
      <div>
        <h2 className="text-[16px] font-bold text-[#1a2433]">내 화물 영향 분석</h2>
        <p className="mt-0.5 text-[12px] text-[#828d9d]">화물 HS 챕터·지역을 입력하면 현재 DB의 리스크 이벤트 중 영향 항목을 추려 점검 체크리스트를 만듭니다 · DB 기준, 추정·임의 수치 없음</p>
      </div>
      <div className="grid gap-3 min-[640px]:grid-cols-2">
        <div>
          <label className="text-[11px] text-[#828d9d]">HS 챕터 (쉼표로 구분)</label>
          <input value={hsInput} onChange={(e) => setHsInput(e.target.value)} placeholder="예: 84, 85, 87" inputMode="numeric" className="mt-0.5 w-full rounded-[8px] border border-[#d8dfe9] bg-white px-2.5 py-2 text-xs" />
        </div>
        <div>
          <label className="text-[11px] text-[#828d9d]">지역·국가 (선택)</label>
          <input value={regionInput} onChange={(e) => setRegionInput(e.target.value)} placeholder="예: EU, US, CN" className="mt-0.5 w-full rounded-[8px] border border-[#d8dfe9] bg-white px-2.5 py-2 text-xs" />
        </div>
      </div>
      {matches === null ? (
        <p className="text-xs text-[#828d9d]">HS 챕터 또는 지역을 입력하세요.</p>
      ) : matches.length === 0 ? (
        <p className="text-xs text-[#828d9d]">입력 조건에 해당하는 리스크 이벤트가 없습니다 (현재 DB 기준).</p>
      ) : (
        <div className="space-y-2">
          <p className="text-xs font-medium text-[#1a2433]">{matches.length}건 해당 — 점검 체크리스트</p>
          <PolicyChecklist items={matches} checkedIds={checkedIds} onToggle={toggleChecked} onSelect={setSelected} />
        </div>
      )}
      <DetailDrawer open={selected !== null} onClose={() => setSelected(null)} title={selected?.title_ko ?? ""}>
        {selected && <PolicyDetail policy={selected} />}
      </DetailDrawer>
    </section>
  );
}

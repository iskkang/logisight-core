import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { z } from "zod";

import { DataMeta } from "@/components/ui/DataMeta";
import { asiaThroughputQueryOptions } from "@/lib/api/asia";
import { ASIA_COUNTRIES, toCsv } from "@/lib/asia-table";
import { seoHead } from "@/lib/seo";

// 동아시아 컨테이너 물동량 — 월간 리포트의 원자료 부록. PHASE 2 EA-5.
//
// ■ 이 페이지는 목적지가 아니다 ★
// 처음에는 독립 페이지로 만들었는데, "동아시아 물동량 표"를 검색해서 찾아오는 사람은 없다.
// 한국 물동량이 필요하면 해수부로 가고 홍콩이 필요하면 HKMPB 로 간다. 어디에도 없는 표라는
// 사실은 수요의 근거가 아니다 —— 없는 표는 대개 아무도 원하지 않아서 없다.
//
// 그래서 독자가 이미 있는 곳(월간 리포트)에 해석을 싣고, 이 페이지는 그 원자료와 CSV 를
// 놓아두는 부록으로 둔다. noindex 로 색인에서 빼고 메뉴에도 걸지 않는다.
// 리포트에서 "원자료 보기"로 들어오는 사람과 CSV 를 받으러 오는 사람에게만 필요하다.
//
// 의도적으로 하지 않는 것: 차트·지도·AI 해설. 해석은 리포트가 한다.
//
// 화면 상태는 URL 쿼리로만 둔다(?months=). localStorage 를 쓰지 않는다 —— 링크를 공유하면
// 같은 화면이 나와야 한다.

const MONTH_CHOICES = [12, 18, 24, 36] as const;

const DEFAULT_MONTHS = 12;

// months 를 옵셔널로 둔다 ★
// .catch(12) 로 기본값을 채우면 URL 에 없는 값을 만들어내고, 라우터가 정규화하려고
// /asia → /asia?months=12 로 307 리다이렉트한다. 맨 주소가 리다이렉트되면 공유·색인에
// 불리하다. 기본값은 쓰는 자리에서 정한다.
const searchSchema = z.object({
  months: z.number().int().min(1).max(36).optional().catch(undefined),
});

export const Route = createFileRoute("/asia")({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ months: search.months ?? DEFAULT_MONTHS }),
  loader: async ({ context, deps }) => {
    await context.queryClient.ensureQueryData(asiaThroughputQueryOptions(deps.months));
  },
  head: () => {
    const base = seoHead({
      title: "동아시아 컨테이너 물동량 (원자료) — Logisight",
      description:
        "한국·일본·대만·홍콩의 월별 컨테이너 물동량 원자료와 CSV. 월간 리포트의 부록입니다.",
      path: "/asia",
    });
    // 부록이라 색인하지 않는다. 해석은 리포트에 있고, 여기 있는 것은 숫자뿐이다.
    return { ...base, meta: [...base.meta, { name: "robots", content: "noindex,nofollow" }] };
  },
  component: AsiaPage,
});

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

function AsiaPage() {
  const months = Route.useSearch().months ?? DEFAULT_MONTHS;
  const navigate = useNavigate({ from: "/asia" });
  const { data: rows } = useSuspenseQuery(asiaThroughputQueryOptions(months));

  function downloadCsv() {
    const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `logisight-asia-throughput-${months}m.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="mx-auto w-full max-w-[1100px] px-4 py-8">
      <h1 className="text-[22px] font-bold text-[#1a2433]">동아시아 컨테이너 물동량 (원자료)</h1>
      <p className="mt-2 max-w-[720px] text-[13px] leading-relaxed text-[#5b6672]">
        한국·일본·대만·홍콩의 월별 컨테이너 처리량(TEU)과 전년 대비 증감입니다. 각국 공식
        통계에서 직접 수집하며, <b>확보되지 않은 달은 0으로 채우지 않고 비워 둡니다.</b>
        <br />
        해석은 월간 리포트에 싣습니다. 이 페이지는 그 원자료와 CSV 를 놓아두는 부록입니다.
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {MONTH_CHOICES.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => navigate({ search: { months: m } })}
            className={`rounded border px-2.5 py-1 text-[12px] ${
              m === months
                ? "border-[#1a2433] bg-[#1a2433] text-white"
                : "border-[#d8dee6] bg-white text-[#5b6672] hover:border-[#9aa5b1]"
            }`}
          >
            최근 {m}개월
          </button>
        ))}
        <button
          type="button"
          onClick={downloadCsv}
          className="ml-auto rounded border border-[#d8dee6] bg-white px-2.5 py-1 text-[12px] text-[#5b6672] hover:border-[#9aa5b1]"
        >
          CSV 내려받기
        </button>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[680px] border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-[#d8dee6] text-[12px] text-[#5b6672]">
              <th className="px-2 py-2 text-left font-semibold">연월</th>
              {ASIA_COUNTRIES.map((c) => (
                <th key={c.code} className="px-2 py-2 text-right font-semibold">
                  {c.label}
                  <span className="ml-1 font-normal text-[#9aa5b1]">{c.code}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="lsg-mono">
            {rows.map((r) => (
              <tr key={r.period} className="border-b border-[#eef1f5]">
                <td className="px-2 py-1.5 text-left text-[#1a2433]">{r.period}</td>
                {ASIA_COUNTRIES.map((c) => {
                  const cell = r.cells[c.code];
                  return (
                    <td key={c.code} className="px-2 py-1.5 text-right tabular-nums">
                      {cell ? (
                        <>
                          <span className="text-[#1a2433]">{fmt(cell.teu)}</span>
                          {cell.yoyPct != null ? (
                            <span
                              className={`ml-1.5 text-[11px] ${cell.yoyPct >= 0 ? "text-[#0f766e]" : "text-[#b91c1c]"}`}
                              title={cell.yoyFromSource ? "출처 공표 전년비" : "본 표 시계열로 계산한 전년비"}
                            >
                              {cell.yoyPct >= 0 ? "▲" : "▼"}
                              {Math.abs(cell.yoyPct).toFixed(1)}%
                            </span>
                          ) : null}
                          {cell.preliminary ? (
                            <span className="ml-1 text-[10px] text-[#c2410c]" title="잠정치 — 이후 정정될 수 있다">
                              잠정
                            </span>
                          ) : null}
                        </>
                      ) : (
                        <span className="text-[11px] text-[#9aa5b1]">데이터 확보 중</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <DataMeta
        className="mt-4"
        source={ASIA_COUNTRIES.filter((c) => c.source !== "—").map((c) => `${c.code} ${c.source}`).join(" · ")}
        cadence="월간"
        unit="TEU"
        method="각국 공식 통계의 전국·전 지역 합계(일본만 주요 6항). 국가마다 계열 하나만 쓰고 섞지 않는다."
      />

      <ul className="mt-3 space-y-1 text-[11px] leading-relaxed text-[#828d9d]">
        {ASIA_COUNTRIES.filter((c) => c.note).map((c) => (
          <li key={c.code}>
            <b>{c.label}</b> — {c.note}
          </li>
        ))}
        <li>
          전년 대비는 출처가 공표하면 그 값을, 아니면 이 표의 시계열로 계산합니다(값에 마우스를
          올리면 어느 쪽인지 나옵니다).
        </li>
        <li>합계 열은 두지 않습니다 —— 한 나라라도 비면 합계가 그 달만 작아집니다.</li>
      </ul>
    </main>
  );
}

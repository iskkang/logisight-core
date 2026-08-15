import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { z } from "zod";

import { DataMeta } from "@/components/ui/DataMeta";
import { asiaThroughputQueryOptions } from "@/lib/api/asia";
import { ASIA_COUNTRIES, toCsv } from "@/lib/asia-table";
import { seoHead } from "@/lib/seo";

// 동아시아 컨테이너 물동량 — 표 하나 + CSV. PHASE 2 EA-5.
//
// 의도적으로 하지 않는 것: 차트·지도·AI 해설. 이 페이지가 파는 것은 "한 표에 모여 있다"는
// 사실이지 시각화가 아니다. 축이 다 차기 전에 꾸미면 빈 칸이 디자인 문제로 보인다.
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
  head: () =>
    seoHead({
      title: "동아시아 컨테이너 물동량 — 한·일·대·홍·베 월별 TEU",
      description:
        "한국·일본·대만·홍콩·베트남의 월별 컨테이너 물동량을 하나의 표로. 각국 공식 통계 원본에서 수집하며, 확보되지 않은 달은 채우지 않고 비워 둔다.",
      path: "/asia",
    }),
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
      <h1 className="text-[22px] font-bold text-[#1a2433]">동아시아 컨테이너 물동량</h1>
      <p className="mt-2 max-w-[720px] text-[13px] leading-relaxed text-[#5b6672]">
        한국·일본·대만·홍콩·베트남의 월별 컨테이너 처리량(TEU)입니다. 각국 공식 통계에서 직접
        수집하며, <b>확보되지 않은 달은 0으로 채우지 않고 비워 둡니다.</b>
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
        method="각국 공식 통계의 전국(또는 전 지역) 합계. 항만별 계열은 섞지 않는다."
      />

      <ul className="mt-3 space-y-1 text-[11px] leading-relaxed text-[#828d9d]">
        {ASIA_COUNTRIES.filter((c) => c.note).map((c) => (
          <li key={c.code}>
            <b>{c.label}</b> — {c.note}
          </li>
        ))}
        <li>
          일본은 전국 확보 통계(JP_ALL)를 씁니다. 더 최근인 주요 6항 속보는 집계 범위가 달라
          같은 열에 섞지 않습니다.
        </li>
      </ul>
    </main>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";

import { HomeNav } from "@/components/home/HomeNav";
import { HomeFooter } from "@/components/home/HomeFooter";
import { seoHead } from "@/lib/seo";
import { INDEX_SOURCE, DATASET_SOURCE } from "@/lib/dataSources";

// 데이터 방법론 — 출처·단위·갱신주기·표현 원칙을 한곳에 정리한 레퍼런스 페이지.
// 각 데이터 페이지 하단에서 "데이터 방법론 보기"로 링크한다. 실시간 수치는 각 페이지에서 확인.

const INDEX_META: { code: string; unit: string; cadence: string }[] = [
  { code: "KCCI", unit: "$/FEU (지수)", cadence: "주간" },
  { code: "SCFI", unit: "지수", cadence: "주간" },
  { code: "CCFI", unit: "지수", cadence: "주간" },
  { code: "WCI", unit: "$/FEU", cadence: "주간" },
  { code: "FBX", unit: "$/FEU", cadence: "주간" },
  { code: "BDI", unit: "지수", cadence: "일간" },
  { code: "NYFI", unit: "$ (레인별)", cadence: "주간" },
  { code: "ERAI", unit: "USD/FEU", cadence: "주간/월간" },
];

const DATASET_META: { name: string; source: string; unit: string; cadence: string }[] = [
  { name: "교역(수출입)", source: DATASET_SOURCE.trade, unit: "USD·물량", cadence: "월간" },
  { name: "항만 혼잡", source: DATASET_SOURCE.port, unit: "혼잡도 지수", cadence: "주간" },
  { name: "항공 운임", source: DATASET_SOURCE.air, unit: "USD/kg", cadence: "월간" },
  { name: "해상 운임", source: DATASET_SOURCE.sea, unit: "$/FEU·TEU", cadence: "월간" },
  { name: "환율", source: DATASET_SOURCE.fx, unit: "KRW", cadence: "일간" },
  { name: "항공유", source: DATASET_SOURCE.jetFuel, unit: "USD/bbl", cadence: "주간" },
];

export const Route = createFileRoute("/methodology")({
  head: () =>
    seoHead({
      title: "데이터 방법론 — Logisight",
      description:
        "Logisight가 사용하는 운임 지수(KCCI·SCFI·CCFI·WCI·FBX·BDI·NYFI·ERAI)와 교역·항만·환율 데이터의 출처·단위·갱신주기, 그리고 추정·정합·상관 표현 원칙과 데이터 부재·극저가 레인 처리 정책.",
      path: "/methodology",
    }),
  component: MethodologyPage,
});

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="border-b border-[#22304a] px-3 py-2 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-[#8595ab]">
      {children}
    </th>
  );
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="border-b border-[#161f31] px-3 py-2.5 text-[13.5px] text-[#c7d2e0]">{children}</td>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="mb-3 border-b border-[#22304a] pb-2 text-[13px] font-bold uppercase tracking-[0.12em] text-[#8595ab]">
        {title}
      </h2>
      {children}
    </section>
  );
}

function MethodologyPage() {
  return (
    <div className="min-h-screen bg-[#070b16] text-[#c7d2e0]">
      <HomeNav />
      <main className="mx-auto w-full max-w-[920px] px-4 pb-20 pt-10 min-[640px]:px-7">
        <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#2dd4bf]">Methodology</p>
        <h1 className="mt-2 text-[28px] font-extrabold leading-tight text-[#e9eef7] min-[640px]:text-[34px]">
          데이터 방법론
        </h1>
        <p className="mt-3 max-w-[640px] text-[14px] leading-[1.7] text-[#93a1b7]">
          Logisight가 표시하는 지수·교역·항만·환율 데이터의 출처·단위·갱신주기와 표현 원칙을 정리했습니다.
          실시간 수치는 각 데이터 페이지에서 확인하세요.
        </p>

        <Section title="운임 지수 출처">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <Th>지수</Th>
                  <Th>발표 기관</Th>
                  <Th>단위</Th>
                  <Th>갱신주기</Th>
                </tr>
              </thead>
              <tbody>
                {INDEX_META.map((r) => (
                  <tr key={r.code}>
                    <Td>
                      <b className="text-[#e9eef7]">{r.code}</b>
                    </Td>
                    <Td>{INDEX_SOURCE[r.code] ?? "확인 중"}</Td>
                    <Td>{r.unit}</Td>
                    <Td>{r.cadence}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="교역·항만·환율 데이터 출처">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <Th>데이터</Th>
                  <Th>출처</Th>
                  <Th>단위</Th>
                  <Th>갱신주기</Th>
                </tr>
              </thead>
              <tbody>
                {DATASET_META.map((r) => (
                  <tr key={r.name}>
                    <Td>
                      <b className="text-[#e9eef7]">{r.name}</b>
                    </Td>
                    <Td>{r.source}</Td>
                    <Td>{r.unit}</Td>
                    <Td>{r.cadence}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="표현 원칙 (추정·정합·상관)">
          <ul className="space-y-2.5 text-[14px] leading-[1.7] text-[#a9b6c9]">
            <li>
              방법론이 확정되지 않은 영역에서는 인과 단정을 피합니다. <b className="text-[#e9eef7]">“~때문에”</b> 같은
              단정 대신 <b className="text-[#e9eef7]">“~와 정합”, “~추정”, “~상관”</b> 표현을 사용합니다.
            </li>
            <li>
              지수 간 <b className="text-[#e9eef7]">선행·후행 단정은 사용하지 않습니다</b>(방법론 미확정). 상관·정합·추정
              관점으로만 제공합니다.
            </li>
          </ul>
        </Section>

        <Section title="데이터가 없을 때">
          <ul className="space-y-2.5 text-[14px] leading-[1.7] text-[#a9b6c9]">
            <li>
              임의 수치로 채우지 않고 <b className="text-[#e9eef7]">“데이터 수집 중”</b>으로 표시합니다. 값이 없는 것과
              0은 구분합니다(<b className="text-[#e9eef7]">결측 ≠ 0</b>).
            </li>
            <li>개별 화물 단위 원자료는 노출하지 않으며, 집계 지표만 표시합니다.</li>
          </ul>
        </Section>

        <Section title="극저가 레인 (통계 기준)">
          <p className="text-[14px] leading-[1.7] text-[#a9b6c9]">
            일부 단거리 항로는 신고/통계 기준상 극저가($1/FEU 등)로 집계될 수 있습니다. 이런 값은 숨기지 않고
            <b className="text-[#e9eef7]"> “통계 기준”</b> 배지로 표시합니다. 실제 선사 all-in rate, THC, local charge,
            surcharge는 별도 확인이 필요하며 통계값과 차이가 날 수 있습니다.
          </p>
        </Section>

        <Section title="AI 전망 (초안·검수)">
          <p className="text-[14px] leading-[1.7] text-[#a9b6c9]">
            시장 전망은 정량 모델 채점 결과를 에디터가 검수해 발행하는 AI 초안입니다. 화면에 “AI 초안 · 에디터 검수”로
            표기하며, 적중률은 발행된 전망 전수를 기준으로 집계합니다(표본 임의 제외 없음).
          </p>
        </Section>

        <div className="mt-12 flex flex-wrap gap-3 text-[13px]">
          <Link to="/faq" className="font-semibold text-[#2dd4bf] hover:underline">
            자주 묻는 질문 →
          </Link>
          <Link to="/rates" className="font-semibold text-[#2dd4bf] hover:underline">
            운임 대시보드 →
          </Link>
        </div>
      </main>
      <HomeFooter />
    </div>
  );
}

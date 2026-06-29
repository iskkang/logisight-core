import { createFileRoute } from "@tanstack/react-router";

import { HomeNav } from "@/components/home/HomeNav";
import { HomeFooter } from "@/components/home/HomeFooter";
import { seoHead, faqPageSchema, type FaqItem } from "@/lib/seo";

// 자주 묻는 질문 — 주제별 섹션으로 통합 관리. 정의·방법론 중심의 에버그린 Q&A만 둔다
// (실시간 수치는 각 데이터 페이지에서 확인). FAQPage JSON-LD는 이 페이지에만 출력.
const SECTIONS: { title: string; items: FaqItem[] }[] = [
  {
    title: "운임·지수",
    items: [
      {
        q: "KCCI는 무엇인가요?",
        a: "한국해양진흥공사(KOBC)가 발표하는 한국발 컨테이너 운임 종합지수입니다. 부산 등 한국발 주요 항로의 운임 수준을 지수화합니다.",
      },
      {
        q: "SCFI와 KCCI는 어떻게 다른가요?",
        a: "SCFI는 상하이항운교역소가 발표하는 상하이발 지수이고, KCCI는 한국발 지수입니다. 출발지와 산정 항로가 달라 같은 시점이라도 수준과 등락이 다를 수 있습니다.",
      },
      {
        q: "항공 운임은 어떻게 표기하나요?",
        a: "USD/kg 원본값에 KRW 환산·적용환율·환율기준일을 함께 표기합니다. 해상과 항공은 단위가 다르므로 별도로 봅니다.",
      },
      {
        q: "운임 데이터는 얼마나 자주 갱신되나요?",
        a: "글로벌 스팟 지수(주간)와 KITA 해상·항공 운임을 기반으로 주 단위로 갱신됩니다.",
      },
    ],
  },
  {
    title: "철도·유라시아",
    items: [
      {
        q: "ERAI 지수란 무엇인가요?",
        a: "Eurasian Rail Alliance Index의 약자로, 유라시아(중국–유럽) 철도 운임 벤치마크입니다. Logisight는 index1520이 제공하는 ERAI 스냅샷을 표시합니다.",
      },
      {
        q: "TCR·TSR은 무엇인가요?",
        a: "TCR은 중국횡단철도, TSR은 시베리아횡단철도로, 아시아와 유럽을 잇는 대표 대륙횡단 철도 회랑입니다.",
      },
      {
        q: "미주 철도 코리도어의 '상태'는 무엇을 뜻하나요?",
        a: "정상·주의·지연 등은 코리도어별 운영 상태 모니터링 결과로, 지표 기반 추정입니다. 단정이 아닌 정합·추정 관점으로 제공됩니다.",
      },
    ],
  },
  {
    title: "무역·산업",
    items: [
      {
        q: "무역 데이터의 출처는 무엇인가요?",
        a: "관세청 수출입무역통계를 기반으로 하며 월 단위로 집계됩니다.",
      },
      {
        q: "HS 챕터란 무엇인가요?",
        a: "국제 통일상품분류(HS)의 2자리 대분류입니다. Logisight는 HS 챕터별 교역액·무역수지를 보여줍니다.",
      },
      {
        q: "산업 데이터가 물류와 어떻게 연결되나요?",
        a: "HS 챕터별 교역 흐름을 운송수단·장비·레인 수요와 매핑해 보여줍니다. 인과 단정이 아닌 상관·정합 관점입니다.",
      },
    ],
  },
  {
    title: "정책·리스크",
    items: [
      {
        q: "항만 혼잡·초크포인트 리스크는 어떻게 산정되나요?",
        a: "공개 집계 기반 지표(지연율·혼잡도 등)를 모니터링해 표시합니다. 개별 화물 단위 데이터는 노출하지 않습니다.",
      },
      {
        q: "어떤 정책·규제를 추적하나요?",
        a: "무역·물류에 영향을 주는 규제 이벤트를 추적해 상태·시점과 함께 정리합니다.",
      },
    ],
  },
  {
    title: "기후",
    items: [
      {
        q: "기후 리스크는 어떻게 감지하나요?",
        a: "AI 기상 예보를 기반으로 전 세계 항만·해협·내륙 철도 거점의 기상 리스크를 모니터링합니다. 확정이 아닌 예측·가능성으로 제공됩니다.",
      },
    ],
  },
  {
    title: "시장 전망",
    items: [
      {
        q: "시장 전망은 어떻게 만들어지나요?",
        a: "정량 모델 채점 결과를 에디터가 검수해 발행하는 AI 초안입니다. 화면에 'AI 초안·에디터 검수'로 표기하며, 발행 후 본문은 사전 명시된 무효 조건 외에는 수정·삭제하지 않습니다.",
      },
      {
        q: "전망 적중률은 어떻게 집계되나요?",
        a: "발행된 전망 전수를 기준으로 판정일 실측을 통해 집계합니다. 특정 표본만 골라 빼지 않습니다.",
      },
    ],
  },
  {
    title: "데이터·신뢰성",
    items: [
      {
        q: "표현이 '추정·정합·상관'인 이유는 무엇인가요?",
        a: "방법론이 확정되지 않은 영역에서 인과 단정을 피하기 위함입니다. 선행·후행 같은 단정 표현은 사용하지 않습니다.",
      },
      {
        q: "데이터가 없을 때는 어떻게 표시하나요?",
        a: "임의 수치로 채우지 않고 '데이터 수집 중'으로 표시합니다.",
      },
    ],
  },
];

const ALL_ITEMS: FaqItem[] = SECTIONS.flatMap((s) => s.items);

export const Route = createFileRoute("/faq")({
  head: () =>
    seoHead({
      title: "자주 묻는 질문 — Logisight",
      description:
        "운임 지수(KCCI·SCFI), 유라시아 철도(ERAI), 무역·산업, 정책·리스크, 기후, 시장 전망과 데이터 방법론에 대한 자주 묻는 질문.",
      path: "/faq",
    }),
  component: FaqPage,
});

function FaqPage() {
  return (
    <div className="min-h-screen bg-[#070b16] text-[#c7d2e0]">
      <HomeNav />
      <main className="mx-auto w-full max-w-[920px] px-4 pb-20 pt-10 min-[640px]:px-7">
        <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#2dd4bf]">FAQ</p>
        <h1 className="mt-2 text-[28px] font-extrabold leading-tight text-[#e9eef7] min-[640px]:text-[34px]">
          자주 묻는 질문
        </h1>
        <p className="mt-3 max-w-[640px] text-[14px] leading-[1.7] text-[#93a1b7]">
          운임·철도·무역·정책·기후·전망과 데이터 방법론에 대한 핵심 질문을 한곳에 모았습니다.
          실시간 수치는 각 데이터 페이지에서 확인하세요.
        </p>

        <div className="mt-9 space-y-10">
          {SECTIONS.map((section) => (
            <section key={section.title}>
              <h2 className="mb-3 border-b border-[#22304a] pb-2 text-[13px] font-bold uppercase tracking-[0.12em] text-[#8595ab]">
                {section.title}
              </h2>
              <dl className="divide-y divide-[#161f31]">
                {section.items.map((item) => (
                  <div key={item.q} className="py-4">
                    <dt className="text-[15px] font-semibold text-[#e9eef7]">{item.q}</dt>
                    <dd className="mt-2 text-[14px] leading-[1.7] text-[#a9b6c9]">{item.a}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </main>
      <HomeFooter />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqPageSchema(ALL_ITEMS)) }}
      />
    </div>
  );
}

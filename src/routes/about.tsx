import { createFileRoute, Link } from "@tanstack/react-router";

import { seoHead } from "@/lib/seo";

// 소개 — 무엇을 발행하는지, 누가 운영하는지, 어떻게 만드는지.
// 소유 공시를 전역 푸터 링크 칼럼이 아니라 여기에 모은다(미디어 관례).
export const Route = createFileRoute("/about")({
  head: () =>
    seoHead({
      title: "소개 — Logisight",
      description:
        "Logisight는 운임 지수·물류 뉴스·정책 변화를 매주 한 편의 분석으로 정리하는 물류 인텔리전스 매체입니다.",
      path: "/about",
    }),
  component: AboutPage,
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-7">
      <h2 className="text-base font-bold text-[var(--color-ink)]">{title}</h2>
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-[var(--color-ink-muted)]">
        {children}
      </div>
    </section>
  );
}

const linkCls = "underline transition-colors hover:text-[var(--color-navy-600)]";

function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 lg:px-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-ink-muted)]">
        Logisight
      </p>
      <h1 className="mt-1 text-2xl font-bold text-[var(--color-ink)]">소개</h1>

      <p className="mt-6 text-sm leading-relaxed text-[var(--color-ink-muted)]">
        Logisight는 운임 지수, 물류 뉴스, 정책 변화, 유라시아 코리도어 동향을 매주 한 편의 분석으로
        정리하는 물류 인텔리전스 매체입니다. 한국 화주·포워더가 의사결정에 쓸 수 있는 형태로 흩어진
        정보를 모읍니다.
      </p>

      <Section title="무엇을 발행하나">
        <ul className="list-disc space-y-1 pl-5">
          <li>주간 뉴스레터 — 매주 월요일, 한 주의 운임·시황·정책을 한 편으로</li>
          <li>
            <Link to="/reports" className={linkCls}>
              마켓 리포트
            </Link>{" "}
            — 주간·월간 심층 분석
          </li>
          <li>
            <Link to="/news" className={linkCls}>
              물류 뉴스
            </Link>{" "}
            — 해상·항공·철도·무역 큐레이션
          </li>
          <li>
            <Link to="/rates" className={linkCls}>
              운임 대시보드
            </Link>{" "}
            — SCFI·KCCI·WCI·FBX·BDI 등 주요 지수
          </li>
        </ul>
      </Section>

      <Section title="어떻게 만드나">
        <p>
          공개 데이터와 공표 지수를 자체 파이프라인으로 수집·정규화한 뒤, 편집 과정을 거쳐
          발행합니다. 지표별 산출 근거와 출처는{" "}
          <Link to="/methodology" className={linkCls}>
            데이터 방법론
          </Link>{" "}
          페이지에 정리돼 있습니다.
        </p>
        <p>기사에 인용한 외부 매체의 원문은 항상 출처를 밝히고 원문으로 연결합니다.</p>
      </Section>

      <Section title="운영 주체">
        <p>
          Logisight는{" "}
          <strong className="font-semibold text-[var(--color-ink)]">MTL Shipping Agency</strong>가
          운영합니다. 유라시아 철도 회랑 등 일부 지표는 운영사가 보유한 실적 데이터를 익명 집계해
          산출하며, 해당 지표에는 출처를 별도로 표기합니다.
        </p>
        <p>
          편집 방향은 운영사의 영업과 분리해 운용합니다. 발행물에 광고·협찬이 포함될 경우 해당
          위치에 명시합니다.
        </p>
      </Section>

      <Section title="문의">
        <p>
          제보·정정 요청·제휴 문의:{" "}
          <a className={linkCls} href="mailto:newsletter@mtlb.co.kr">
            newsletter@mtlb.co.kr
          </a>
        </p>
        <p>
          개인정보 관련 사항은{" "}
          <Link to="/privacy" className={linkCls}>
            개인정보처리방침
          </Link>
          을 참조하세요.
        </p>
      </Section>
    </div>
  );
}

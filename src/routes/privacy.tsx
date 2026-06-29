import { createFileRoute } from "@tanstack/react-router";

import { seoHead } from "@/lib/seo";

// 개인정보처리방침 — 뉴스레터 구독 시 수집하는 개인정보 기준의 표준 방침.
// 주의: 회사 법무 검토 후 문구·보유기간·위탁업체를 확정하세요(초안 성격).
export const Route = createFileRoute("/privacy")({
  head: () =>
    seoHead({
      title: "개인정보처리방침 — Logisight",
      description: "Logisight 뉴스레터 구독 시 수집·이용하는 개인정보에 관한 처리방침입니다.",
      path: "/privacy",
    }),
  component: PrivacyPage,
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-7">
      <h2 className="text-base font-bold text-[var(--color-ink)]">{title}</h2>
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-[var(--color-ink-muted)]">{children}</div>
    </section>
  );
}

function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 lg:px-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-ink-muted)]">Logisight</p>
      <h1 className="mt-1 text-2xl font-bold text-[var(--color-ink)]">개인정보처리방침</h1>
      <p className="mt-2 text-xs text-[var(--color-ink-muted)]">시행일: 2026-06-29</p>

      <p className="mt-6 text-sm leading-relaxed text-[var(--color-ink-muted)]">
        MTL Shipping Agency(이하 “회사”)는 Logisight 뉴스레터 서비스 제공을 위해 아래와 같이 개인정보를
        수집·이용하며, 「개인정보 보호법」 및 「정보통신망 이용촉진 및 정보보호 등에 관한 법률」을 준수합니다.
      </p>

      <Section title="1. 수집하는 개인정보 항목">
        <ul className="list-disc space-y-1 pl-5">
          <li>필수: 이메일 주소, 이름</li>
          <li>선택: 회사명, 관심 분야(해상·항공·철도·무역·물류)</li>
          <li>자동 수집: 구독 일시, 동의 일시, 유입 경로</li>
        </ul>
      </Section>

      <Section title="2. 수집·이용 목적">
        <ul className="list-disc space-y-1 pl-5">
          <li>물류 시장 뉴스레터·인텔리전스 브리핑 발송</li>
          <li>관심 분야 기반 콘텐츠 맞춤화</li>
          <li>구독 관리 및 수신거부 처리</li>
        </ul>
      </Section>

      <Section title="3. 보유 및 이용 기간">
        <p>
          구독 해지 또는 동의 철회 시까지 보유하며, 이후 지체 없이 파기합니다. 관계 법령에 따라 보존이
          필요한 경우 해당 기간 동안 보관합니다.
        </p>
      </Section>

      <Section title="4. 처리 위탁 및 국외 이전">
        <p>
          원활한 서비스 제공을 위해 이메일 발송 및 데이터 보관 업무를 아래 사업자에 위탁하며, 해당 데이터는
          국외에 저장·처리될 수 있습니다.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>이메일 발송: Resend (newsletter@mtlb.co.kr 발신)</li>
          <li>데이터 보관(호스팅): Supabase</li>
        </ul>
      </Section>

      <Section title="5. 제3자 제공">
        <p>회사는 이용자의 개인정보를 외부에 제공하지 않습니다. 단, 법령에 근거가 있는 경우는 예외로 합니다.</p>
      </Section>

      <Section title="6. 동의 철회 및 수신거부">
        <p>
          모든 뉴스레터 하단의 <strong>“수신 거부”</strong> 링크를 통해 언제든지 수신을 중단(동의 철회)할 수
          있습니다. 철회 시 해당 개인정보는 파기됩니다.
        </p>
      </Section>

      <Section title="7. 이용자의 권리">
        <p>이용자는 자신의 개인정보에 대한 열람·정정·삭제·처리정지를 요청할 수 있으며, 아래 연락처로 문의할 수 있습니다.</p>
      </Section>

      <Section title="8. 문의처">
        <p>
          개인정보 관련 문의: <a className="underline text-[var(--color-navy-900)]" href="mailto:newsletter@mtlb.co.kr">newsletter@mtlb.co.kr</a>
        </p>
      </Section>
    </div>
  );
}

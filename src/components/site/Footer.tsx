// 다크 네이비 푸터 — 브랜드+칩 / 서비스·뉴스·MTL 링크 / 뉴스레터 밴드 / © 라인.
// 프로토타입(Logisight 인터랙티브 프로토타입) AppFooter 구성.
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { NewsletterForm } from "./NewsletterForm";

export function Footer() {
  return (
    <footer className="text-white" style={{ background: "var(--color-navy-900)" }}>
      <div className="mx-auto grid max-w-[1540px] gap-6 px-4 pt-10 lg:grid-cols-[1.6fr_1fr_1fr_1fr] lg:px-12">
        <div>
          <Link to="/" className="inline-block" aria-label="Logisight 홈">
            <img src="/logisight_logo.svg" alt="Logisight" className="h-8 w-auto" />
          </Link>
          <p className="mt-2.5 max-w-[280px] text-[12.5px] leading-relaxed text-white/65">
            MTL Shipping Agency가 운영하는 한국 화주·포워더를 위한 물류 인텔리전스.
          </p>
          <div className="mt-3.5 flex flex-wrap gap-2">
            {["유라시아 코리도어 전문", "공공데이터 기반"].map((t) => (
              <span
                key={t}
                className="rounded-full border border-white/20 px-[11px] py-1 text-[11px] font-semibold text-white/75"
              >
                {t}
              </span>
            ))}
          </div>
        </div>

        <FooterCol title="서비스">
          <li><Link to="/rates" className={linkCls}>운임 대시보드</Link></li>
          <li><Link to="/rail" className={linkCls}>철도 코리도어</Link></li>
          <li><Link to="/industries" className={linkCls}>산업별 교역</Link></li>
        </FooterCol>

        <FooterCol title="뉴스">
          {(["해상", "항공", "철도", "무역"] as const).map((cat) => (
            <li key={cat}>
              <Link to="/news" search={{ cat }} className={linkCls}>
                {cat}
              </Link>
            </li>
          ))}
        </FooterCol>

        <FooterCol title="MTL">
          <li>
            <a href="https://mtlship.com" target="_blank" rel="noopener noreferrer" className={linkCls}>
              회사소개
            </a>
          </li>
          <li><a href="#newsletter" className={linkCls}>뉴스레터 구독</a></li>
          <li><a href="mailto:sales@mtlship.com" className={linkCls}>영업 문의</a></li>
        </FooterCol>
      </div>

      {/* 뉴스레터 밴드 */}
      <div className="mx-auto max-w-[1540px] px-4 pt-7 lg:px-12">
        <div
          id="newsletter"
          className="flex flex-wrap items-center justify-between gap-5 rounded-lg border border-white/[0.14] bg-white/[0.04] px-6 py-5"
        >
          <div>
            <div className="text-[14.5px] font-bold">Weekly Logistics Briefing</div>
            <p className="mt-1 text-[12.5px] text-white/65">
              운임 지수, 정책 변화, 교역 흐름, 유라시아 코리도어 이슈를 매주 정리해 드립니다.
            </p>
          </div>
          <div className="min-w-[260px] max-w-[420px] flex-1">
            <NewsletterForm compact />
          </div>
        </div>
      </div>

      <div className="mx-auto mt-2 flex max-w-[1540px] flex-col gap-1 px-4 pb-6 pt-5 lg:px-12">
        <span className="text-[11.5px] text-white/60">
          Logisight is operated by MTL Shipping Agency.
        </span>
        <span className="text-[11.5px] text-white/50">
          공공데이터 출처: PORT-MIS · 관세청 · 해양수산부
        </span>
        <span className="text-[11.5px] text-white/50">
          © 2026 MTL Shipping Agency. All rights reserved.
        </span>
      </div>
    </footer>
  );
}

function FooterCol({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h4 className="mb-3 text-[12.5px] font-bold text-white">{title}</h4>
      <ul className="space-y-2.5 text-[12.5px] text-white/65">{children}</ul>
    </div>
  );
}

const linkCls = "transition-colors hover:text-white";

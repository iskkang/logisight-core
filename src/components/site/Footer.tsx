import { Link } from "@tanstack/react-router";

import { NewsletterForm } from "./NewsletterForm";

export function Footer() {
  return (
    <footer
      className="mt-20 text-white"
      style={{ background: "#1E293B" }}
    >
      <div className="mx-auto max-w-7xl px-4 py-12 lg:px-6 lg:py-16">
        <div className="grid gap-10 lg:grid-cols-4">
          {/* Brand */}
          <div className="lg:col-span-1">
            <Link to="/" className="inline-block text-xl font-bold tracking-tight">
              <span className="text-white">Logi</span>
              <span style={{ color: "var(--color-cyan)" }}>sight</span>
            </Link>
            <p className="mt-3 text-sm leading-relaxed text-white/70">
              MTL Shipping Agency가 운영하는 한국 화주·포워더를 위한 물류 인텔리전스.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full border border-white/15 px-2.5 py-1 text-[11px] text-white/80">
                유라시아 코리도어 전문
              </span>
              <span className="rounded-full border border-white/15 px-2.5 py-1 text-[11px] text-white/80">
                공공데이터 기반
              </span>
            </div>
          </div>

          {/* 서비스 */}
          <FooterCol title="서비스">
            <FooterLink to="/rates">운임 대시보드</FooterLink>
            <FooterLink to="/eurasia">유라시아 코리도어</FooterLink>
            <FooterLink to="/policy">정책·규제</FooterLink>
            <FooterLink to="/industries">산업별 교역</FooterLink>
          </FooterCol>

          {/* 뉴스 */}
          <FooterCol title="뉴스">
            <FooterLink to="/news" search={{ cat: "해상" }}>
              해상
            </FooterLink>
            <FooterLink to="/news" search={{ cat: "항공" }}>
              항공
            </FooterLink>
            <FooterLink to="/news" search={{ cat: "철도·CIS" }}>
              철도·CIS
            </FooterLink>
            <FooterLink to="/news" search={{ cat: "무역" }}>
              무역
            </FooterLink>
          </FooterCol>

          {/* MTL + 뉴스레터 */}
          <div className="lg:col-span-1">
            <h4 className="text-sm font-semibold uppercase tracking-wider text-white/90">
              MTL
            </h4>
            <ul className="mt-4 space-y-2 text-sm text-white/70">
              <li>
                <a
                  href="https://mtlship.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition-colors hover:text-[var(--color-cyan)]"
                >
                  회사소개
                </a>
              </li>
              <li>
                <a
                  href="#newsletter"
                  className="transition-colors hover:text-[var(--color-cyan)]"
                >
                  뉴스레터 구독
                </a>
              </li>
              <li>
                <a
                  href="mailto:sales@mtlship.com"
                  className="transition-colors hover:text-[var(--color-cyan)]"
                >
                  영업 문의
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Newsletter */}
        <div
          id="newsletter"
          className="mt-12 rounded-lg border border-white/10 bg-white/[0.03] p-6 lg:p-8"
        >
          <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <h3 className="text-lg font-bold text-white">
                매주 한 편의 물류 브리핑
              </h3>
              <p className="mt-1 text-sm text-white/60">
                운임 지수, 정책 변화, 코리도어 동향을 정리한 뉴스레터를 받아보세요.
              </p>
            </div>
            <div className="lg:min-w-[360px]">
              <NewsletterForm />
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-10 flex flex-col gap-3 border-t border-white/10 pt-6 text-xs text-white/50 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © 2026 MTL Shipping Agency · 공공데이터(PORT-MIS · 관세청 · 해양수산부) 기반
          </p>
          <p>logisight.mtlship.com</p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h4 className="text-sm font-semibold uppercase tracking-wider text-white/90">
        {title}
      </h4>
      <ul className="mt-4 space-y-2 text-sm text-white/70">{children}</ul>
    </div>
  );
}

function FooterLink({
  to,
  search,
  children,
}: {
  to: string;
  search?: Record<string, string>;
  children: React.ReactNode;
}) {
  return (
    <li>
      <Link
        to={to}
        search={search as never}
        className="transition-colors hover:text-[var(--color-cyan)]"
      >
        {children}
      </Link>
    </li>
  );
}
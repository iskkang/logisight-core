import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { NewsletterForm } from "./NewsletterForm";

export function Footer({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <footer className="mt-0 bg-[#102036] text-white">
        <div className="mx-auto max-w-[1540px] px-4 py-7 lg:px-12">
          <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1.8fr]">
            <div>
              <Link to="/" className="inline-block text-xl font-bold tracking-normal">
                <span className="text-white">Logi</span>
                <span style={{ color: "var(--color-cyan)" }}>sight</span>
              </Link>
              <p className="mt-2 text-xs leading-6 text-white/68">
                MTL Shipping Agency가 운영하는 해상·무역·물류 인텔리전스 플랫폼.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <a href="https://mtlship.com" target="_blank" rel="noopener noreferrer" className="rounded-md border border-white/18 px-3 py-1 text-xs font-semibold text-white/80 hover:text-white">
                  회사 소개
                </a>
                <a href="#newsletter" className="rounded-md border border-white/18 px-3 py-1 text-xs font-semibold text-white/80 hover:text-white">
                  이용 약관
                </a>
              </div>
            </div>

            <FooterCol title="서비스" compact>
              <li><Link to="/rates" className={linkCls}>운임 대시보드</Link></li>
              <li><Link to="/eurasia" className={linkCls}>유라시아 모니터링</Link></li>
              <li><Link to="/industries" className={linkCls}>산업별 리포트</Link></li>
            </FooterCol>

            <FooterCol title="뉴스" compact>
              {(["해상 뉴스", "항공 뉴스", "경제·정책", "물류 브리핑"] as const).map((label) => (
                <li key={label}>
                  <Link to="/news" className={linkCls}>{label}</Link>
                </li>
              ))}
            </FooterCol>

            <FooterCol title="MTL" compact>
              <li><a href="https://mtlship.com" target="_blank" rel="noopener noreferrer" className={linkCls}>회사 소개</a></li>
              <li><a href="#newsletter" className={linkCls}>뉴스레터 구독</a></li>
              <li><a href="mailto:sales@mtlship.com" className={linkCls}>영업 문의</a></li>
            </FooterCol>

            <div id="newsletter" className="rounded-lg border border-white/12 bg-white/[0.05] p-4">
              <h3 className="text-sm font-black text-white">매주 한 번의 물류 브리핑</h3>
              <p className="mt-1 text-xs leading-5 text-white/62">
                운임, 시황, 정책, 대외 동향을 한눈에 정리해 드립니다.
              </p>
              <div className="mt-3">
                <NewsletterForm />
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-2 border-t border-white/10 pt-4 text-[11px] text-white/45 sm:flex-row sm:items-center sm:justify-between">
            <p>© 2026 MTL Shipping Agency · 상호명(주)엠티엘 · 공공데이터 기반</p>
            <p>logisight.mtlship.com</p>
          </div>
        </div>
      </footer>
    );
  }

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
            <li><Link to="/rates" className={linkCls}>운임 대시보드</Link></li>
            <li><Link to="/eurasia" className={linkCls}>유라시아 코리도어</Link></li>
            <li><Link to="/industries" className={linkCls}>산업별 교역</Link></li>
          </FooterCol>

          {/* 뉴스 */}
          <FooterCol title="뉴스">
            {(["해상", "항공", "철도·CIS", "무역"] as const).map((cat) => (
              <li key={cat}>
                <Link
                  to="/news"
                  search={{ cat }}
                  className={linkCls}
                >
                  {cat}
                </Link>
              </li>
            ))}
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
  compact = false,
}: {
  title: string;
  children: ReactNode;
  compact?: boolean;
}) {
  return (
    <div>
      <h4 className={`${compact ? "text-xs font-black" : "text-sm font-semibold uppercase tracking-wider"} text-white/90`}>
        {title}
      </h4>
      <ul className={`${compact ? "mt-3 space-y-1.5 text-xs" : "mt-4 space-y-2 text-sm"} text-white/70`}>{children}</ul>
    </div>
  );
}

const linkCls = "transition-colors hover:text-[var(--color-cyan)]";

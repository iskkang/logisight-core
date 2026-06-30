// src/components/home/HomeFooter.tsx
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Wordmark } from "./Wordmark";

const WRAP = "mx-auto w-full max-w-[1200px] px-[18px] min-[620px]:px-7";

function Col({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h6 className="mb-[13px] text-[11px] font-bold uppercase tracking-[0.12em] text-[#93a1b7]">{title}</h6>
      {children}
    </div>
  );
}
const itemCls = "block py-[5px] text-[#5d6b80] transition-colors hover:text-[#2dd4bf]";

export function HomeFooter() {
  return (
    <footer className="border-t border-[#78a0cd1c] bg-[#060912] pt-12 pb-[30px] text-[13px] text-[#5d6b80]">
      <div className={WRAP}>
        <div className="grid grid-cols-1 gap-[30px] border-b border-[#78a0cd1c] pb-[30px] min-[980px]:grid-cols-[1.6fr_1fr_1fr_1fr]">
          <div>
            <Wordmark />
            <p className="mb-3.5 mt-2.5 max-w-[240px] leading-[1.55] text-[#93a1b7]">(주)MTL이 운영하는 물류 인텔리전스</p>
          </div>
          <Col title="서비스">
            <Link to="/rates" className={itemCls}>운임 대시보드</Link>
            <Link to="/rail" className={itemCls}>철도 코리도어</Link>
            <Link to="/industries" className={itemCls}>산업별 교역</Link>
            <Link to="/reports" className={itemCls}>마켓 리포트</Link>
            <Link to="/methodology" className={itemCls}>데이터 방법론</Link>
            <Link to="/faq" className={itemCls}>자주 묻는 질문</Link>
          </Col>
          <Col title="뉴스">
            {(["해상", "항공", "철도", "무역"] as const).map((cat) => (
              <Link key={cat} to="/news" search={{ cat }} className={itemCls}>{cat}</Link>
            ))}
          </Col>
          <Col title="MTL">
            <a href="https://www.mtlship.com" target="_blank" rel="noopener noreferrer" className={itemCls}>회사소개</a>
            <a href="#newsletter" className={itemCls}>뉴스레터 구독</a>
            <a href="mailto:sales@mtlship.com" className={itemCls}>영업 문의</a>
          </Col>
        </div>
        <div className="pt-[22px] lsg-mono text-[11.5px] leading-[1.8] text-[#445064]">
          Logisight is operated by MTL Shipping Agency. · 공공데이터 출처: PORT-MIS · 관세청 · 해양수산부<br />
          © 2026 MTL Shipping Agency. All rights reserved.
        </div>
      </div>
    </footer>
  );
}

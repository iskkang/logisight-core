import { Link } from "@tanstack/react-router";
import { useId } from "react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { findTerm, termAnchor } from "@/data/glossary";

/**
 * 용어 옆에 붙는 ⓘ — 눌러서 뜻을 본다. PHASE 3-2.
 *
 * ■ 왜 tooltip 이 아니라 popover 인가
 * 이 사이트 표는 모바일에서 더 많이 열린다. tooltip 은 hover 로 뜨는데 터치 화면에는
 * hover 가 없어서, 그대로 쓰면 모바일에서 아무 일도 일어나지 않는다.
 * popover 는 클릭·탭 양쪽에서 열리고 Esc·바깥 클릭으로 닫힌다.
 * (둘 다 이미 있는 컴포넌트다. 새로 만들지 않는다.)
 *
 * ■ 표를 흔들지 않는다 ★
 * 표 헤더에 들어가는 물건이라 폭이 늘면 기존 반응형이 깨진다.
 * - 아이콘은 12px 인라인, 글자 흐름 안에 둔다
 * - 트리거를 whitespace-nowrap 으로 묶어 용어와 ⓘ 사이에서 줄이 바뀌지 않게 한다
 * - 아이콘 자체에는 여백을 최소로 준다(ml-0.5)
 *
 * ■ 접근성
 * 버튼에 aria-describedby 로 설명 요소를 물린다. 화면 낭독기가 용어를 읽을 때 뜻이
 * 함께 읽힌다. 아이콘만 있는 버튼이라 aria-label 도 따로 준다.
 *
 * 용어집에 없는 말이면 아무것도 렌더하지 않는다 —— 뜻 없는 ⓘ 를 띄우지 않는다.
 */
export function MetricTerm({ term, className = "" }: { term: string; className?: string }) {
  const entry = findTerm(term);
  const descId = useId();
  if (!entry) return <>{term}</>;

  return (
    <span className={`whitespace-nowrap ${className}`}>
      {term}
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={`${entry.term} 뜻 보기`}
            aria-describedby={descId}
            className="ml-0.5 inline-flex h-3 w-3 translate-y-[1px] items-center justify-center rounded-full border border-current text-[8px] leading-none opacity-55 transition-opacity hover:opacity-100"
          >
            i
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[280px] rounded-[10px] border-[#d8dfe9] bg-white p-3.5 text-[#1a2433] shadow-lg"
        >
          <div className="text-[13px] font-bold">{entry.term}</div>
          <p id={descId} className="mt-1.5 text-[12.5px] leading-relaxed text-[#54606f]">
            {entry.short}
          </p>
          <Link
            to="/glossary"
            hash={termAnchor(entry.term)}
            className="mt-2.5 inline-block text-[11.5px] text-[#0d9488] hover:underline"
          >
            자세히 →
          </Link>
        </PopoverContent>
      </Popover>
    </span>
  );
}

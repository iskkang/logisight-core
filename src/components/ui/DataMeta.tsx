// 데이터 카드·표 하단 통일 메타. 출처 / 기준일 / 갱신주기 / 단위 / 산정방식을 한 포맷으로 표기한다.
// 값이 없는 항목은 생략한다(빈 항목 표시 안 함). 텍스트만 사용 → SSR 안전.
import type { ReactNode } from "react";

export interface DataMetaProps {
  source?: ReactNode; // 출처
  asOf?: ReactNode; // 기준일
  cadence?: ReactNode; // 갱신주기
  unit?: ReactNode; // 단위
  method?: ReactNode; // 산정방식
  className?: string;
}

export function DataMeta({ source, asOf, cadence, unit, method, className = "" }: DataMetaProps) {
  const items = ([
    ["출처", source],
    ["기준일", asOf],
    ["갱신주기", cadence],
    ["단위", unit],
    ["산정방식", method],
  ] as [string, ReactNode][]).filter(([, v]) => v != null && v !== "");
  if (items.length === 0) return null;
  return (
    <dl className={`flex flex-wrap gap-x-3 gap-y-1 text-[11px] leading-snug text-[#828d9d] ${className}`}>
      {items.map(([k, v]) => (
        <span key={k} className="inline-flex gap-1">
          <dt className="font-semibold">{k}</dt>
          <dd className="lsg-mono">{v}</dd>
        </span>
      ))}
    </dl>
  );
}

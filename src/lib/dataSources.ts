// 데이터 출처 단일 원천(SSOT). 지수·데이터셋의 실제 발표 기관을 한곳에 모아 화면 출처 표기를
// 추측 없이 일관되게 한다. 코드 추적으로 확인한 실제 소스만 등재한다.
//  - SCFI/CCFI: 상하이해운거래소(SSE)
//  - KCCI:      한국해양진흥공사(KOBC)
//  - WCI:       Drewry
//  - FBX:       Freightos Baltic Index
//  - BDI:       Baltic Exchange
//  - NYFI:      New York Shipping Exchange(NYSHEX)  — src/lib/api/nyfi.functions.ts (nyshex 피드)
//  - ERAI:      index1520 (Eurasian Rail Alliance Index)

export const INDEX_SOURCE: Record<string, string> = {
  SCFI: "상하이해운거래소 (SSE)",
  CCFI: "상하이해운거래소 (SSE)",
  KCCI: "한국해양진흥공사 (KOBC)",
  WCI: "Drewry (WCI)",
  FBX: "Freightos (FBX)",
  BDI: "Baltic Exchange (BDI)",
  NYFI: "New York Shipping Exchange (NYSHEX)",
  ERAI: "index1520 (ERAI)",
};

/** 지수 코드의 발표 기관. 모르면 null(추측 금지). */
export function indexSource(code: string): string | null {
  return INDEX_SOURCE[code] ?? null;
}

// 그 외 데이터셋 출처(지수 외).
export const DATASET_SOURCE = {
  trade: "관세청 수출입무역통계",
  port: "PORT-MIS (해양수산부)",
  air: "KITA 항공운임",
  sea: "KITA 해상운임",
  fx: "하나은행 고시환율",
  jetFuel: "IATA / Platts",
  // 코드 추적으로 확인: 호르무즈·Persian Gulf = Shipfinder(risk.functions), 해협 통과 TEU = EconDB
  // (econdb.com/widgets/chokepoint-pass), 항만 혼잡(median 대기일) = Portcast(파이프라인 port-congestion.js).
  // ※ PORT-MIS(해수부/KOSIS)는 한국 항만 '처리량(throughput)' 출처 — 글로벌 '혼잡'에는 쓰지 말 것.
  shipfinder: "Shipfinder",
  econdb: "EconDB",
  portcast: "Portcast",
} as const;

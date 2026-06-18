import { queryOptions } from "@tanstack/react-query";

import { getTradeStatistics, getChapterTradePartners } from "./industries.functions";

export type TradeStatRow = {
  period: string;
  stat_type: string;
  hs_code: string | null;
  hs_name: string | null;
  country_code: string | null;
  country_name: string | null;
  export_usd: number | null;
  export_weight: number | null;
  import_usd: number | null;
  import_weight: number | null;
  trade_balance: number | null;
};

export const tradeStatisticsQueryOptions = () =>
  queryOptions({
    queryKey: ["trade_statistics", "item"],
    queryFn: () => getTradeStatistics(),
    staleTime: 10 * 60 * 1000,
  });

// HS 챕터별 상위 교역국(item_country 집계) — 드릴다운 펼칠 때 온디맨드 조회.
export const chapterPartnersQueryOptions = (chapter: string) =>
  queryOptions({
    queryKey: ["trade_statistics", "item_country", chapter],
    queryFn: () => getChapterTradePartners({ data: { chapter } }),
    staleTime: 10 * 60 * 1000,
    enabled: /^\d{2}$/.test(chapter),
  });

// HS 2-digit chapter Korean names (standard HS nomenclature)
export const HS_CHAPTERS: Record<string, string> = {
  "01": "산 동물", "02": "육류", "03": "어패류", "04": "낙농품·조란",
  "05": "기타 동물성 생산품", "06": "산수목·꽃", "07": "채소",
  "08": "과실·견과", "09": "커피·차·향신료", "10": "곡물",
  "11": "곡분·전분", "12": "유지작물·종자", "13": "수지·식물성액즙",
  "14": "기타 식물성 생산품", "15": "동·식물성유지", "16": "육·어류 조제품",
  "17": "당류·설탕과자", "18": "코코아·초콜릿", "19": "곡물조제품",
  "20": "채소·과실 조제품", "21": "기타 조제식료품", "22": "음료·주류",
  "23": "사료", "24": "담배", "25": "소금·황·토석류", "26": "광",
  "27": "광물성연료·원유", "28": "무기화학품", "29": "유기화학품",
  "30": "의료용품", "31": "비료", "32": "염료·안료·페인트",
  "33": "향료·화장품", "34": "비누·계면활성제", "35": "단백질계 물질",
  "36": "화약류", "37": "감광성 재료", "38": "각종 화학공업 생산품",
  "39": "플라스틱", "40": "고무", "41": "원피·가죽", "42": "가죽제품",
  "43": "모피", "44": "목재", "45": "코르크", "46": "조물재료 제품",
  "47": "펄프", "48": "지·판지", "49": "서적·인쇄물", "50": "견",
  "51": "양모·동물털", "52": "면", "53": "기타 식물성섬유", "54": "인조필라멘트",
  "55": "인조스테이플섬유", "56": "워딩·부직포", "57": "양탄자",
  "58": "특수직물", "59": "침투·도포 직물", "60": "편물",
  "61": "편물제 의류", "62": "직물제 의류", "63": "기타 섬유제품",
  "64": "신발", "65": "모자", "66": "우산", "67": "조제우모",
  "68": "석·시멘트·석면 제품", "69": "도자제품", "70": "유리",
  "71": "귀석·귀금속", "72": "철강", "73": "철강제품", "74": "구리",
  "75": "니켈", "76": "알루미늄", "78": "납", "79": "아연", "80": "주석",
  "81": "기타 비금속", "82": "공구·칼붙이", "83": "기타 비금속제품",
  "84": "기계류", "85": "전기기기", "86": "철도차량",
  "87": "자동차·차량", "88": "항공기", "89": "선박", "90": "광학·정밀기기",
  "91": "시계", "92": "악기", "93": "무기", "94": "가구·조명",
  "95": "완구·스포츠용품", "96": "잡품", "97": "예술품·골동품",
};

export function hsChapter(code: string | null): string {
  if (!code) return "—";
  return code.length >= 2 ? code.slice(0, 2) : code;
}

export function hsChapterName(chapter: string): string {
  return HS_CHAPTERS[chapter] ?? "기타";
}

export function formatPeriod(p: string): string {
  // 데이터에 "202606"·"2026-06" 두 포맷이 섞여 들어옴 — 숫자만 추출해 통일 처리.
  const d = (p ?? "").replace(/\D/g, "");
  if (d.length < 6) return p;
  return `${d.slice(0, 4)}.${d.slice(4, 6)}`;
}

export function formatUSD(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

export function formatTon(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  // export_weight unit: kg → convert to tonnes
  const t = n / 1000;
  const abs = Math.abs(t);
  if (abs >= 1e6) return `${(t / 1e6).toFixed(2)}Mt`;
  if (abs >= 1e3) return `${(t / 1e3).toFixed(2)}Kt`;
  return `${t.toLocaleString("ko-KR", { maximumFractionDigits: 1 })}t`;
}
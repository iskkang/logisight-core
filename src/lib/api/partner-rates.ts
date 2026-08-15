import { queryOptions } from "@tanstack/react-query";
import { getPublishedPartnerRates, listKitaDests, listRateSheets } from "./partner-rates.functions";

// 관리자 전용 쿼리 — 서버함수가 토큰으로 admin 역할을 확인한다.
// 토큰은 queryKey 에 넣지 않는다(캐시 키·devtools 에 남는다). 세션이 붙기 전에는 enabled:false.
export const rateSheetsHistoryQueryOptions = (token: string) =>
  queryOptions({
    queryKey: ["rate_sheets", "history"],
    queryFn: () => listRateSheets({ data: { token } }),
    staleTime: 30 * 1000,
    enabled: token.length > 0,
  });

export const publishedPartnerRatesQueryOptions = () =>
  queryOptions({
    queryKey: ["partner_rates", "published"],
    queryFn: () => getPublishedPartnerRates(),
    staleTime: 5 * 60 * 1000,
  });

export const kitaDestsQueryOptions = (token: string) =>
  queryOptions({
    queryKey: ["kita_sea_rates", "dests"],
    queryFn: () => listKitaDests({ data: { token } }),
    staleTime: 30 * 60 * 1000,
    enabled: token.length > 0,
  });

import { queryOptions } from "@tanstack/react-query";
import { getPublishedPartnerRates, listKitaDests, listRateSheets } from "./partner-rates.functions";

export const rateSheetsHistoryQueryOptions = () =>
  queryOptions({
    queryKey: ["rate_sheets", "history"],
    queryFn: () => listRateSheets(),
    staleTime: 30 * 1000,
  });

export const publishedPartnerRatesQueryOptions = () =>
  queryOptions({
    queryKey: ["partner_rates", "published"],
    queryFn: () => getPublishedPartnerRates(),
    staleTime: 5 * 60 * 1000,
  });

export const kitaDestsQueryOptions = () =>
  queryOptions({
    queryKey: ["kita_sea_rates", "dests"],
    queryFn: () => listKitaDests(),
    staleTime: 30 * 60 * 1000,
  });

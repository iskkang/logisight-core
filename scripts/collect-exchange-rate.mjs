/**
 * 한국수출입은행 OpenAPI에서 USD/KRW 환율을 수집해 Supabase에 저장합니다.
 *
 * 환경 변수:
 *   KOREAEXIM_API_KEY  - 수출입은행 Encoding 키 (그대로 사용, encodeURIComponent 금지)
 *   SUPABASE_URL       - Supabase 프로젝트 URL
 *   SUPABASE_SERVICE_ROLE_KEY - service_role 키
 */
import { createClient } from "@supabase/supabase-js";

const API_KEY = process.env.KOREAEXIM_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Required env vars missing: KOREAEXIM_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function todayKst() {
  const now = new Date();
  // KST = UTC+9
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10).replace(/-/g, "");
}

async function fetchRate(searchDate) {
  // IMPORTANT: API_KEY is Encoding key — used as-is, no encodeURIComponent
  const url = `https://www.koreaexim.go.kr/site/program/financial/exchangeJSON?authkey=${API_KEY}&searchdate=${searchDate}&data=AP01`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (!Array.isArray(json)) throw new Error("Unexpected response format");
  return json;
}

async function main() {
  const date = todayKst();
  console.log(`Collecting exchange rate for ${date}`);

  let items;
  try {
    items = await fetchRate(date);
  } catch (err) {
    console.error("API fetch failed:", err.message);
    process.exit(1);
  }

  // Find USD
  const usdEntry = items.find((item) => item.cur_unit === "USD");
  if (!usdEntry) {
    console.error("USD not found in response. Items:", items.map((i) => i.cur_unit).join(", "));
    process.exit(1);
  }

  // deal_bas_r is the base rate, formatted as "1,300.00"
  const usdKrw = parseFloat(String(usdEntry.deal_bas_r).replace(/,/g, ""));
  if (!isFinite(usdKrw) || usdKrw <= 0) {
    console.error("Invalid rate value:", usdEntry.deal_bas_r);
    process.exit(1);
  }

  const rateDate = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
  console.log(`USD/KRW = ${usdKrw} (${rateDate})`);

  const { error } = await supabase
    .from("exchange_rates")
    .upsert({ rate_date: rateDate, usd_krw: usdKrw, source: "koreaexim" });

  if (error) {
    console.error("Supabase upsert failed:", error.message);
    process.exit(1);
  }

  console.log("Done.");
}

main();

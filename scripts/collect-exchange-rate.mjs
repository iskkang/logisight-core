/**
 * 네이버 금융 API에서 USD/EUR/CNY → KRW 환율을 수집해 Supabase에 저장합니다.
 * API 키 불필요. 출처: api.stock.naver.com
 *
 * 환경 변수:
 *   SUPABASE_URL               - Supabase 프로젝트 URL
 *   SUPABASE_SERVICE_ROLE_KEY  - service_role 키
 */
import { createClient } from "@supabase/supabase-js";
import ws from "ws";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Required env vars missing: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { transport: ws },
});

const CURRENCIES = ["FX_USDKRW", "FX_EURKRW", "FX_CNYKRW", "FX_JPYKRW", "FX_RUBKRW"];
const BASE_URL = "https://api.stock.naver.com/marketindex/exchange";
const HEADERS = { "User-Agent": "Mozilla/5.0 (compatible; logisight-collector/1.0)" };

async function fetchRate(reutersCode) {
  const res = await fetch(`${BASE_URL}/${reutersCode}`, {
    headers: HEADERS,
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${reutersCode}`);
  const json = await res.json();
  const ei = json.exchangeInfo;
  if (!ei) throw new Error(`No exchangeInfo in response for ${reutersCode}`);

  const value = parseFloat(String(ei.closePrice).replace(/,/g, ""));
  if (!isFinite(value) || value <= 0) throw new Error(`Invalid closePrice for ${reutersCode}: ${ei.closePrice}`);

  // localTradedAt: "2026-06-09T19:17:23+09:00"
  const rateDate = ei.localTradedAt.slice(0, 10);
  return { value, rateDate };
}

async function main() {
  console.log("Collecting exchange rates from Naver Finance...");

  const results = {};
  for (const code of CURRENCIES) {
    try {
      const { value, rateDate } = await fetchRate(code);
      results[code] = { value, rateDate };
      console.log(`${code}: ${value} (${rateDate})`);
    } catch (err) {
      console.error(`Failed to fetch ${code}:`, err.message);
    }
  }

  const usd = results["FX_USDKRW"];
  if (!usd) {
    console.error("USD/KRW fetch failed — cannot proceed");
    process.exit(1);
  }

  const rateDate = usd.rateDate;
  const row = {
    rate_date: rateDate,
    usd_krw: usd.value,
    eur_krw: results["FX_EURKRW"]?.value ?? null,
    cny_krw: results["FX_CNYKRW"]?.value ?? null,
    jpy_krw: results["FX_JPYKRW"]?.value ?? null,
    rub_krw: results["FX_RUBKRW"]?.value ?? null,
    source: "naver_finance",
  };

  const { error } = await supabase.from("exchange_rates").upsert(row);
  if (error) {
    console.error("Supabase upsert failed:", error.message);
    process.exit(1);
  }

  console.log("Done.", row);
}

main();

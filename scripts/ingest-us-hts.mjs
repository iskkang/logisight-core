#!/usr/bin/env node
/**
 * 미국 HTS(Harmonized Tariff Schedule) 적재.
 *
 * 필요 env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * USITC 가 전체를 한 번에 주는 공개 엔드포인트를 쓴다. 실측 12.7MB · 6초 ·
 * 35,805행. www.usitc.gov 의 벌크 파일(hts_2026_*.json)은 403 으로 막혀 있어
 * 쓸 수 없고, hts.usitc.gov 의 reststop 쪽만 열려 있다.
 *
 * EU 와 달리 연 1회가 아니다 —— 2026년 8월까지 Revision 15 였다. 개정 발생을
 * 알려주는 엔드포인트는 찾지 못했으므로 주기적으로 통째로 다시 받는다.
 * 12.7MB/6초라 부담이 없다.
 *
 * ■ 추가관세(232조·301조 등)는 적재하지 않는다 ★
 * 그것들은 99류에 "The duty provided in the applicable subheading + 25%" 같은
 * 조항으로 있고, 적용 범위가 "Except for products described in headings
 * 9903.01.30–9903.01.33, ..." 식의 예외 사슬이다. 어느 품목·원산지에 걸리는지는
 * U.S. Notes 를 해석해야 나온다 —— 데이터 조회가 아니라 법령 해석이다.
 * 지금 넣을 수 있는 건 기본세율(general)과 한-미 FTA 특혜세율(special 의 KR)
 * 뿐이고, 화면에서 "추가관세 미포함"을 반드시 같이 말해야 한다.
 */

const SOURCE_URL = "https://hts.usitc.gov/reststop/exportList?from=0101&to=9999&format=JSON&styles=true";
// 99류(추가관세 조항). 한국산을 지목한 조항만 골라 "확인 필요" 표시용으로 쓴다.
const CHAPTER99_URL = "https://hts.usitc.gov/reststop/exportList?from=9903&to=9904&format=JSON&styles=true";
const CITE_URL = "https://hts.usitc.gov/";
const MARKET = "US";
const NOMENCLATURE = "HTS";
const SOURCE_NAME = "US Harmonized Tariff Schedule";
const HEADERS = { "user-agent": "Mozilla/5.0 (compatible; Logisight-HTS-Ingest/1.0; +https://logisight.net)" };

const digitsOf = (value) => String(value ?? "").replace(/[^0-9]/g, "");

/**
 * 세율 문자열을 숫자로 바꾼다. 순수 종가세가 아니면 null 을 돌려준다.
 * "Free" → 0, "3.7%" → 3.7, "11.5¢/kg" → null, "4.4% + 25¢/kg" → null.
 */
function parseRate(raw) {
  const text = String(raw ?? "").trim();
  if (!text) return null;
  if (/^free$/i.test(text)) return 0;
  const m = text.match(/^(\d+(?:\.\d+)?)\s*%$/);
  return m ? Number(m[1]) : null;
}

/**
 * special 열에서 한국(KR)에 적용되는 세율 표현을 뽑는다.
 *
 * 형식: "Free (A+,AU,BH,CL,CO,D,E,IL,JO,KR,MA,OM,P,PA,PE,S,SG)"
 * 여러 그룹이 붙는 경우도 있다:
 *   "Free (BH,CL,CO,JO,KR,...) See 9822.04.01-9822.04.03 (AU)"
 * KR 이 들어 있는 그룹 바로 앞의 표현이 한국에 적용되는 세율이다.
 */
function koreaSpecialRateText(special) {
  const text = String(special ?? "").trim();
  if (!text) return null;
  const groups = [...text.matchAll(/([^()]+)\(([^)]*)\)/g)];
  for (const group of groups) {
    const countries = group[2].split(",").map((x) => x.trim());
    if (countries.includes("KR")) return group[1].trim();
  }
  return null;
}

/**
 * 조항 문구에서 적용 품목군을 유추한다.
 *
 * 추정이다 —— 실제 적용 범위는 U.S. Notes 에 있고 그건 PDF 안에만 있다.
 * 그래서 이 값은 "대상일 수 있으니 확인하라"는 표시에만 쓰고, 세율을 더하거나
 * 적용 여부를 단정하는 데는 쓰지 않는다. 품목군을 못 알아보면 null 로 두는데,
 * 그건 "한국산 전반"이라는 뜻이라 오히려 더 넓게 걸린다.
 */
function categorize(description) {
  const d = description.toLowerCase();
  if (/passenger vehicle|light truck/.test(d)) {
    return /parts of/.test(d)
      ? { prefixes: ["8708"], ko: "승용차·소형트럭 부품" }
      : { prefixes: ["8703", "8704"], ko: "승용차·소형트럭" };
  }
  if (/derivative steel|steel article/.test(d)) return { prefixes: ["72", "73"], ko: "철강·파생 철강제품" };
  if (/aluminum/.test(d)) return { prefixes: ["76"], ko: "알루미늄·파생 알루미늄제품" };
  if (/pharmaceutical/.test(d)) return { prefixes: ["30"], ko: "의약품" };
  // civil aircraft 를 먼저 본다 —— 민간항공기 조항이 제외 문구에서 unmanned 를
  // 언급해 무인기로 잘못 분류됐다(9903.02.81).
  if (/civil aircraft/.test(d)) return { prefixes: ["88"], ko: "민간항공기" };
  if (/unmanned aircraft/.test(d)) return { prefixes: ["8806", "8807"], ko: "무인항공기·부품" };
  if (/wood product|timber|lumber/.test(d)) return { prefixes: ["44"], ko: "목재제품" };
  return { prefixes: null, ko: null };
}

async function fetchChapter99() {
  const response = await fetch(CHAPTER99_URL, { headers: HEADERS });
  if (!response.ok) throw new Error(`Chapter 99 download failed: ${response.status}`);
  const rows = await response.json();
  if (!Array.isArray(rows)) throw new Error("Chapter 99 response is not an array");

  const out = [];
  for (const row of rows) {
    const code = digitsOf(row.htsno);
    if (code.length !== 8) continue;
    const description = String(row.description ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    // 한국산을 지목한 조항만. 이 도구는 한국발 수출 전용이다(From 이 South Korea 고정).
    if (!/\b(South Korea|Republic of Korea)\b/i.test(description)) continue;
    const general = String(row.general ?? "").trim();
    const { prefixes, ko } = categorize(description);
    out.push({
      provision_code: code,
      rate_percent: parseRate(general),
      rate_text: general || null,
      description: description.slice(0, 1200),
      hs_prefixes: prefixes,
      category_ko: ko,
      source_url: CITE_URL,
      is_active: true,
    });
  }
  return out;
}

async function fetchHts() {
  const response = await fetch(SOURCE_URL, { headers: HEADERS });
  if (!response.ok) throw new Error(`HTS download failed: ${response.status} ${response.statusText}`);
  const rows = await response.json();
  if (!Array.isArray(rows)) throw new Error("HTS response is not an array");
  return rows;
}

function build(rows) {
  const nomenclature = [];
  const measures = [];
  const seenCode = new Set();

  for (const row of rows) {
    const code = digitsOf(row.htsno);
    if (code.length !== 8 && code.length !== 10) continue;
    const description = String(row.description ?? "").trim();

    if (description && !seenCode.has(code)) {
      seenCode.add(code);
      nomenclature.push({
        market: MARKET,
        nomenclature: NOMENCLATURE,
        code,
        parent_code: code.slice(0, 6),
        description,
        level: code.length,
        source_name: SOURCE_NAME,
        source_url: CITE_URL,
        source_version: "HTS 2026",
        // customs_nomenclature 의 유니크 키가 (market, nomenclature, code, valid_from)
        // 이라 비워 두면 NULL 이 되어 재적재 때 중복이 쌓인다.
        valid_from: "2026-01-01",
        valid_to: "2026-12-31",
        is_active: true,
        is_leaf: code.length === 10,
      });
    }

    const general = String(row.general ?? "").trim();
    if (general) {
      measures.push({
        market: MARKET,
        code,
        origin_country: null,
        measure_type: "THIRD_COUNTRY_DUTY",
        rate_percent: parseRate(general),
        rate_text: general,
        title: "US HTS general (MFN) duty",
        detail: description || null,
        legal_basis: "Harmonized Tariff Schedule of the United States",
        source_url: CITE_URL,
        is_active: true,
        metadata: { column: "general" },
      });
    }

    const korea = koreaSpecialRateText(row.special);
    if (korea) {
      measures.push({
        market: MARKET,
        code,
        origin_country: "KR",
        measure_type: "PREFERENCE",
        rate_percent: parseRate(korea),
        rate_text: korea,
        title: "KORUS FTA preferential duty",
        detail: description || null,
        legal_basis: "US-Korea Free Trade Agreement (HTS special rate column)",
        source_url: CITE_URL,
        is_active: true,
        metadata: { column: "special", special_raw: String(row.special ?? "").slice(0, 400) },
      });
    }
  }

  // 같은 (code, origin, type) 이 두 번 나오면 뒤엣것을 버린다 —— upsert 가
  // 한 배치 안에서 같은 키를 두 번 만나면 실패한다.
  const unique = new Map();
  for (const m of measures) unique.set(`${m.code}|${m.origin_country ?? ""}|${m.measure_type}`, m);
  return { nomenclature, measures: [...unique.values()] };
}

function guard(nomenclature, measures) {
  if (nomenclature.length < 20000) throw new Error(`Parsed only ${nomenclature.length} HTS lines; refusing suspicious dataset`);
  const mfn = measures.filter((m) => m.measure_type === "THIRD_COUNTRY_DUTY");
  const kr = measures.filter((m) => m.measure_type === "PREFERENCE");
  if (mfn.length < 8000) throw new Error(`Only ${mfn.length} MFN duty rows; refusing`);
  if (kr.length < 4000) throw new Error(`Only ${kr.length} KORUS rows; refusing`);
  // 종가세로 뭉개지지 않았는지 —— 비율세가 아닌데 숫자가 채워져 있으면 버그다.
  const bad = measures.filter((m) => m.rate_percent != null && !/^(free|\d+(\.\d+)?\s*%)$/i.test(String(m.rate_text).trim()));
  if (bad.length) throw new Error(`${bad.length} rows have a numeric rate from a non-ad-valorem text (e.g. ${bad[0].code}: ${bad[0].rate_text})`);
  return { mfn: mfn.length, kr: kr.length };
}

async function upsert(table, rows, conflict) {
  const base = process.env.SUPABASE_URL.replace(/\/+$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = `${base}/rest/v1/${table}?on_conflict=${conflict}`;
  for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500);
    const response = await fetch(url, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(batch),
    });
    if (!response.ok) throw new Error(`${table} upsert failed: ${response.status} ${(await response.text()).slice(0, 300)}`);
  }
}

async function main() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  }
  const rows = await fetchHts();
  console.log(`Downloaded ${rows.length} HTS rows`);
  const { nomenclature, measures } = build(rows);
  const counts = guard(nomenclature, measures);
  console.log(`Parsed ${nomenclature.length} nomenclature lines, ${measures.length} duty rows (MFN ${counts.mfn}, KORUS ${counts.kr})`);
  await upsert("customs_nomenclature", nomenclature, "market,nomenclature,code,valid_from");
  await upsert("customs_duty_measures", measures, "market,code,origin_country,measure_type");

  const provisions = await fetchChapter99();
  // 조항이 사라지면 적재가 조용히 비는 것을 막는다. 2026-10 기준 17건이었다.
  if (provisions.length < 5) throw new Error(`Only ${provisions.length} Korea-related chapter 99 provisions; refusing`);
  await upsert("us_additional_duty_provisions", provisions, "provision_code");
  console.log(`Ingested US HTS (+ ${provisions.length} Korea-related chapter 99 provisions)`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

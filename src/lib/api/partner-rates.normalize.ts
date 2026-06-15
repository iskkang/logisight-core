export function numUSD(v: string | number | null | undefined): number | null {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const cleaned = v.replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function parseTransit(v: string | null | undefined): { min: number | null; max: number | null } {
  if (!v) return { min: null, max: null };
  const nums = String(v).match(/\d+/g);
  if (!nums || nums.length === 0) return { min: null, max: null };
  const a = Number(nums[0]);
  const b = nums.length > 1 ? Number(nums[1]) : a;
  return { min: a, max: b };
}

export function normRouteType(v: string | null | undefined): "DIRECT" | "T_S" | null {
  if (!v) return null;
  const s = v.trim().toUpperCase();
  if (s.startsWith("DIRECT")) return "DIRECT";
  if (s.includes("T/S") || s.includes("T.S") || s.includes("TS ")) return "T_S";
  return null;
}

export function isExpired(validUntil: string | null | undefined, today: string): boolean {
  if (!validUntil) return false;
  return validUntil < today;
}

// 국가 → KITA 권역. /rates 실측 패널을 권역 단위로 필터하기 위함(KITA에 없는 항만도 권역으로 묶음).
// 권역 문자열은 kita_sea_rates.region 값과 정확히 일치해야 함.
const COUNTRY_REGION: Record<string, string> = {
  // 북미
  USA: "북미", "UNITED STATES": "북미", "U.S.A.": "북미", US: "북미", CANADA: "북미",
  // 아시아
  INDIA: "아시아", BANGLADESH: "아시아", PAKISTAN: "아시아", "SRI LANKA": "아시아",
  VIETNAM: "아시아", THAILAND: "아시아", INDONESIA: "아시아", MALAYSIA: "아시아",
  PHILIPPINES: "아시아", MYANMAR: "아시아", SINGAPORE: "아시아", CAMBODIA: "아시아", TAIWAN: "아시아",
  // 중국 / 일본
  CHINA: "중국", "HONG KONG": "중국", JAPAN: "일본",
  // 중남미
  MEXICO: "중남미", CHILE: "중남미", COLOMBIA: "중남미", PANAMA: "중남미", ECUADOR: "중남미",
  GUATEMALA: "중남미", PERU: "중남미", NICARAGUA: "중남미", "COSTA RICA": "중남미",
  "EL SALVADOR": "중남미", BRAZIL: "중남미", ARGENTINA: "중남미", URUGUAY: "중남미", HONDURAS: "중남미",
  // 유럽
  NETHERLANDS: "유럽", GERMANY: "유럽", "UNITED KINGDOM": "유럽", UK: "유럽", FRANCE: "유럽",
  SPAIN: "유럽", ITALY: "유럽", BELGIUM: "유럽", PORTUGAL: "유럽", GREECE: "유럽",
  SWEDEN: "유럽", FINLAND: "유럽", DENMARK: "유럽", NORWAY: "유럽", POLAND: "유럽",
  TURKEY: "유럽", SLOVENIA: "유럽",
  // 중동
  "SAUDI ARABIA": "중동", UAE: "중동", "UNITED ARAB EMIRATES": "중동", QATAR: "중동",
  KUWAIT: "중동", BAHRAIN: "중동", OMAN: "중동", IRAN: "중동", IRAQ: "중동", JORDAN: "중동", YEMEN: "중동",
  // 오세아니아
  AUSTRALIA: "오세아니아", "NEW ZEALAND": "오세아니아",
  // 러시아/CIS
  RUSSIA: "러시아/CIS", "RUSSIAN FEDERATION": "러시아/CIS", KAZAKHSTAN: "러시아/CIS",
  UZBEKISTAN: "러시아/CIS", MONGOLIA: "러시아/CIS",
  // 아프리카
  NIGERIA: "아프리카", TOGO: "아프리카", "COTE D'IVOIRE": "아프리카", GHANA: "아프리카",
  BENIN: "아프리카", "EQUATORIAL GUINEA": "아프리카", SENEGAL: "아프리카", GUINEA: "아프리카",
  "SIERRA LEONE": "아프리카", LIBERIA: "아프리카", MAURITANIA: "아프리카", ANGOLA: "아프리카",
  CONGO: "아프리카", CAMEROON: "아프리카", "SOUTH AFRICA": "아프리카", TANZANIA: "아프리카",
  KENYA: "아프리카", MOZAMBIQUE: "아프리카", MADAGASCAR: "아프리카", EGYPT: "아프리카",
  // 한글 국가명(견적표가 한글 country를 쓰는 경우)
  미국: "북미", 캐나다: "북미",
  베트남: "아시아", 태국: "아시아", 인도네시아: "아시아", 말레이시아: "아시아", 싱가포르: "아시아",
  필리핀: "아시아", 인도: "아시아", 방글라데시: "아시아", 파키스탄: "아시아", 스리랑카: "아시아",
  캄보디아: "아시아", 미얀마: "아시아", 대만: "아시아",
  중국: "중국", 홍콩: "중국", 일본: "일본",
  멕시코: "중남미", 칠레: "중남미", 콜롬비아: "중남미", 파나마: "중남미", 에콰도르: "중남미",
  과테말라: "중남미", 페루: "중남미", 니카라과: "중남미", 코스타리카: "중남미", 엘살바도르: "중남미",
  브라질: "중남미", 아르헨티나: "중남미", 우루과이: "중남미", 온두라스: "중남미",
  네덜란드: "유럽", 독일: "유럽", 영국: "유럽", 프랑스: "유럽", 스페인: "유럽", 이탈리아: "유럽",
  벨기에: "유럽", 포르투갈: "유럽", 그리스: "유럽", 스웨덴: "유럽", 핀란드: "유럽", 덴마크: "유럽",
  노르웨이: "유럽", 폴란드: "유럽", 터키: "유럽", 슬로베니아: "유럽",
  사우디아라비아: "중동", 사우디: "중동", 아랍에미리트: "중동", 아랍에미레이트: "중동", 카타르: "중동",
  쿠웨이트: "중동", 바레인: "중동", 오만: "중동", 이란: "중동", 이라크: "중동", 요르단: "중동", 예멘: "중동",
  호주: "오세아니아", 오스트레일리아: "오세아니아", 뉴질랜드: "오세아니아",
  러시아: "러시아/CIS", 카자흐스탄: "러시아/CIS", 우즈베키스탄: "러시아/CIS", 몽골: "러시아/CIS",
  나이지리아: "아프리카", 토고: "아프리카", 코트디부아르: "아프리카", 가나: "아프리카", 베냉: "아프리카",
  적도기니: "아프리카", 세네갈: "아프리카", 기니: "아프리카", 시에라리온: "아프리카", 라이베리아: "아프리카",
  모리타니: "아프리카", 앙골라: "아프리카", 콩고: "아프리카", 카메룬: "아프리카",
  남아프리카공화국: "아프리카", 남아공: "아프리카", 탄자니아: "아프리카", 케냐: "아프리카",
  모잠비크: "아프리카", 마다가스카르: "아프리카", 이집트: "아프리카",
};

// 미국 주 약자 — POD가 "도시, XX" 형식(country 결측)일 때 북미로 판정.
const US_STATES = new Set([
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME",
  "MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA",
  "RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC",
]);

export function regionOfCountry(country: string | null | undefined): string | null {
  if (!country) return null;
  const k = country.trim().toUpperCase();
  if (k === "방글라" || k.includes("BANGLA") || k === "방글라데시") return "아시아";
  // 점·공백 제거 변형도 시도(예: "U.A.E" → "UAE")
  const k2 = k.replace(/[.\s]/g, "");
  return COUNTRY_REGION[k] ?? COUNTRY_REGION[k2] ?? null;
}

// country 없을 때 폴백용 — 국가명이 안 붙는 단일 항만명 사전.
const PORT_REGION: Record<string, string> = {
  // 아시아
  KARACHI: "아시아", CHENNAI: "아시아", KOLKATA: "아시아", VISAKHAPATNAM: "아시아",
  "NHAVA SHEVA": "아시아", PIPAVAV: "아시아", MUNDRA: "아시아", COLOMBO: "아시아", CHITTAGONG: "아시아",
  // 북미(미국·캐나다 주요 항만)
  "LONG BEACH": "북미", "LOS ANGELES": "북미", SAVANNAH: "북미", HOUSTON: "북미",
  "NEW YORK": "북미", MOBILE: "북미", SEATTLE: "북미", OAKLAND: "북미", CHARLESTON: "북미",
  NORFOLK: "북미", BALTIMORE: "북미", MIAMI: "북미", TACOMA: "북미", VANCOUVER: "북미",
  // 중동
  "JEBEL ALI": "중동", DUBAI: "중동", DAMMAM: "중동", JEDDAH: "중동", "ABU DHABI": "중동",
  DOHA: "중동", "KING ABDULLAH": "중동", SOHAR: "중동", "UMM QASR": "중동", BAHRAIN: "중동", AQABA: "중동",
  // 오세아니아
  SYDNEY: "오세아니아", MELBOURNE: "오세아니아", BRISBANE: "오세아니아", FREMANTLE: "오세아니아",
  ADELAIDE: "오세아니아", AUCKLAND: "오세아니아", LYTTELTON: "오세아니아", TAURANGA: "오세아니아",
};

// 권역 결정: country 우선 → 미국 주 약자(", XX") → POD에 박힌 국가명 → 단일 항만 사전.
export function regionOf(
  country: string | null | undefined,
  pod: string | null | undefined,
): string | null {
  const byCountry = regionOfCountry(country);
  if (byCountry) return byCountry;
  if (!pod) return null;
  const up = pod.toUpperCase();
  if (up.includes("BANGLA")) return "아시아";
  const st = up.match(/,\s*([A-Z]{2})\s*$/);
  if (st && US_STATES.has(st[1])) return "북미";
  for (const c of Object.keys(COUNTRY_REGION)) {
    if (up.includes(c)) return COUNTRY_REGION[c];
  }
  for (const p of Object.keys(PORT_REGION)) {
    if (up.includes(p)) return PORT_REGION[p];
  }
  return null;
}

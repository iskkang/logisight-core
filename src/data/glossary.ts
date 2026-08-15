/**
 * 물류 용어집. PHASE 3-2.
 *
 * ■ 왜 사이트 안에 두나
 * 우리 화면은 TEU·FEU·SCFI·결항률 같은 말을 설명 없이 쓴다. 업계 사람에겐 당연하지만
 * 처음 보는 사람에게는 숫자를 읽을 수 없게 만드는 벽이다. 툴팁으로 그 자리에서 풀고,
 * /glossary 에 전체를 모은다("FEU 뜻"·"SCFI란" 같은 검색어가 실제로 있다).
 *
 * ■ 쓰는 규칙
 * short —— 한 문장. 툴팁에 그대로 들어간다. 길면 툴팁이 화면을 덮는다.
 * long  —— 두세 문장. /glossary 에서 보여준다. 왜 중요한지까지 적는다.
 * aliases —— 본문에서 다르게 쓰이는 표기. 검색과 매칭에 쓴다.
 *
 * ■ 지수 설명에는 발표 기관을 반드시 적는다
 * 어느 기관이 내는 숫자인지가 그 지수의 성격을 결정한다. lib/dataSources.ts 의 표기와
 * 어긋나지 않게 맞춘다.
 */

export type GlossaryCategory = "container" | "index" | "measure" | "operation";

export type GlossaryEntry = {
  term: string;
  short: string;
  long: string;
  category: GlossaryCategory;
  aliases?: string[];
};

export const CATEGORY_LABEL: Record<GlossaryCategory, string> = {
  container: "컨테이너·화물",
  index: "운임 지수",
  measure: "측정·비교",
  operation: "운항·항만",
};

export const GLOSSARY: GlossaryEntry[] = [
  // ── 컨테이너·화물 ──────────────────────────────────────────────
  {
    term: "TEU",
    category: "container",
    aliases: ["twenty-foot equivalent unit"],
    short: "20피트 컨테이너 한 개를 1로 세는 물동량 단위입니다.",
    long: "Twenty-foot Equivalent Unit. 크기가 다른 컨테이너를 한 자로 재기 위한 환산 단위로, 40피트 컨테이너는 2TEU로 셉니다. 항만 물동량과 선박 크기는 거의 언제나 이 단위로 표시됩니다.",
  },
  {
    term: "FEU",
    category: "container",
    aliases: ["forty-foot equivalent unit"],
    short: "40피트 컨테이너 한 개를 가리키며 2TEU에 해당합니다.",
    long: "Forty-foot Equivalent Unit. 운임은 대개 FEU 단위로 고시되고 물동량은 TEU로 집계되기 때문에, 같은 화면에서 두 단위가 섞여 나올 수 있습니다. 운임표의 금액이 FEU 기준인지 TEU 기준인지 먼저 확인해야 합니다.",
  },
  {
    term: "FCL",
    category: "container",
    aliases: ["full container load"],
    short: "한 화주가 컨테이너 한 대를 통째로 쓰는 운송입니다.",
    long: "Full Container Load. 화물이 컨테이너를 채울 만큼 많을 때 씁니다. 컨테이너 단위로 요금이 매겨져 LCL보다 단위당 비용이 낮고, 다른 화물과 섞이지 않아 손상·지연 위험도 작습니다.",
  },
  {
    term: "LCL",
    category: "container",
    aliases: ["less than container load"],
    short: "여러 화주의 화물을 한 컨테이너에 모아 싣는 운송입니다.",
    long: "Less than Container Load. 컨테이너를 채우지 못하는 소량 화물이 대상입니다. 부피(CBM) 기준으로 요금을 나눠 내지만, 출발지에서 모으고 도착지에서 나누는 작업이 붙어 FCL보다 시간이 더 걸립니다.",
  },
  {
    term: "CBM",
    category: "container",
    aliases: ["cubic meter", "재화중량", "루베"],
    short: "가로·세로·높이를 곱한 부피로, 1CBM은 1세제곱미터입니다.",
    long: "Cubic Meter. LCL 해상운송과 항공화물 요금의 기준이 되는 부피 단위입니다. 무게가 가벼워도 부피가 크면 요금이 올라가기 때문에, 화물의 무게와 부피 중 어느 쪽이 요금을 결정하는지 따져야 합니다.",
  },
  {
    term: "부피중량",
    category: "container",
    aliases: ["용적중량", "volumetric weight", "dimensional weight"],
    short: "부피를 정해진 계수로 나눠 무게처럼 환산한 값입니다.",
    long: "항공화물에서 부피가 큰 가벼운 화물에도 제값을 받기 위해 씁니다. 보통 부피(㎤)를 6,000으로 나눠 킬로그램으로 바꿉니다. 실제 무게보다 이 값이 크면 요금은 이쪽을 따릅니다.",
  },
  {
    term: "과금중량",
    category: "container",
    aliases: ["chargeable weight", "요금중량"],
    short: "실제 무게와 부피중량 중 더 큰 값으로, 실제로 요금이 매겨지는 무게입니다.",
    long: "Chargeable Weight. 항공사는 무게와 공간 중 먼저 차는 쪽을 기준으로 요금을 받습니다. 그래서 저울에 올린 무게가 그대로 요금이 되지 않는 경우가 흔하며, 견적을 비교할 때는 이 값이 같은지 확인해야 합니다.",
  },

  // ── 운임 지수 ────────────────────────────────────────────────
  {
    term: "SCFI",
    category: "index",
    aliases: ["상하이 컨테이너 운임지수", "Shanghai Containerized Freight Index"],
    short: "상하이해운거래소가 매주 내는 상하이발 컨테이너 스팟 운임 지수입니다.",
    long: "Shanghai Containerized Freight Index. 상하이에서 출발하는 주요 항로의 그때그때 시장 운임(스팟)을 모은 지수로, 컨테이너 시황을 볼 때 가장 널리 쓰입니다. 계약 운임이 아니라 스팟이라 변동이 큽니다.",
  },
  {
    term: "CCFI",
    category: "index",
    aliases: ["중국 컨테이너 운임지수", "China Containerized Freight Index"],
    short: "상하이해운거래소가 내는 중국발 컨테이너 운임 지수로, 계약 운임을 함께 반영합니다.",
    long: "China Containerized Freight Index. 스팟만 보는 SCFI와 달리 장기 계약 운임이 섞여 있어 더 완만하게 움직입니다. 스팟이 먼저 오르고 몇 주 뒤 이 지수가 따라 오르는 식이라, 둘의 차이를 보면 시장 변화가 계약에 얼마나 반영됐는지 가늠할 수 있습니다.",
  },
  {
    term: "KCCI",
    category: "index",
    aliases: ["한국형 컨테이너 운임지수", "Korea Containerized Freight Index"],
    short: "한국해양진흥공사가 매주 내는 부산발 컨테이너 운임 지수입니다.",
    long: "부산에서 출발하는 항로를 대상으로 해 한국 화주·포워더의 체감에 가장 가깝습니다. 같은 시기 SCFI와 견주면 한국발 운임이 상하이발보다 비싼지 싼지를 볼 수 있습니다.",
  },
  {
    term: "WCI",
    category: "index",
    aliases: ["Drewry World Container Index", "세계 컨테이너 운임지수"],
    short: "영국 컨설팅사 Drewry가 내는 주요 8개 항로의 컨테이너 운임 지수입니다.",
    long: "World Container Index. 40피트 컨테이너 실제 지불 운임을 달러로 보여줘 금액을 바로 읽을 수 있는 것이 특징입니다. 지수 형태인 SCFI와 달리 “얼마인가”를 그대로 비교할 수 있습니다.",
  },
  {
    term: "FBX",
    category: "index",
    aliases: ["Freightos Baltic Index"],
    short: "Freightos와 발틱거래소가 함께 내는 컨테이너 스팟 운임 지수입니다.",
    long: "Freightos Baltic Index. 실제 거래 견적을 모아 산출하며 항로별로 40피트 기준 금액을 제공합니다. 갱신이 잦아 시장 방향이 바뀔 때 비교적 빨리 반응합니다.",
  },
  {
    term: "BDI",
    category: "index",
    aliases: ["발틱운임지수", "Baltic Dry Index"],
    short: "발틱거래소가 내는 벌크선(건화물) 운임 지수입니다.",
    long: "Baltic Dry Index. 철광석·석탄·곡물처럼 포장하지 않고 싣는 화물의 운임을 나타냅니다. 컨테이너와는 다른 시장이라, 둘이 반대로 움직이는 것 자체는 이상한 일이 아닙니다.",
  },
  {
    term: "BAI",
    category: "index",
    aliases: ["Baltic Air Freight Index", "발틱 항공운임지수"],
    short: "발틱거래소가 내는 항공화물 운임 지수입니다.",
    long: "Baltic Air Freight Index. 주요 공항 간 항공화물 운임을 주 단위로 집계합니다. 해상 운임이 급등하거나 공급망이 막혔을 때 화물이 항공으로 옮겨가는 흐름을 함께 보면 도움이 됩니다.",
  },

  // ── 측정·비교 ────────────────────────────────────────────────
  {
    term: "MoM",
    category: "measure",
    aliases: ["전월 대비", "month over month"],
    short: "직전 달과 견준 증감입니다.",
    long: "Month over Month. 바로 앞 달을 기준으로 얼마나 늘고 줄었는지 봅니다. 계절 요인이 그대로 섞이므로, 명절이나 성수기가 낀 달은 이 수치만으로 추세를 판단하기 어렵습니다.",
  },
  {
    term: "YoY",
    category: "measure",
    aliases: ["전년 동월 대비", "전년 대비", "year over year"],
    short: "1년 전 같은 달과 견준 증감입니다.",
    long: "Year over Year. 같은 달끼리 비교하므로 계절 요인이 상쇄돼 추세를 보기에 낫습니다. 다만 1년 전이 유난히 높거나 낮았다면 그 기저 때문에 수치가 커 보일 수 있습니다.",
  },
  {
    term: "52주 백분위",
    category: "measure",
    aliases: ["백분위", "percentile", "52주 구간"],
    short: "최근 1년 관측 중 지금 값보다 낮았던 비율입니다.",
    long: "상위 10% 구간이라는 말은 최근 1년의 90%가 지금보다 낮았다는 뜻입니다. 지금 값이 이력 안에서 어디쯤인지를 알려줄 뿐, 앞으로 오르거나 내린다는 뜻은 아닙니다.",
  },

  // ── 운항·항만 ────────────────────────────────────────────────
  {
    term: "결항률",
    category: "operation",
    aliases: ["blank sailing", "블랭크 세일링", "공선율"],
    short: "예정된 항차 중 선사가 취소한 비율입니다.",
    long: "선사가 수요가 줄었을 때 배를 빼서 공급을 조이는 수단입니다. 결항률이 오르면 실을 자리가 줄어 운임이 버티고, 낮으면 선복이 넉넉해 운임이 밀리는 쪽으로 작용합니다.",
  },
  {
    term: "체선·체화",
    category: "operation",
    aliases: ["체선", "체화", "demurrage", "detention", "항만 정체"],
    short: "배가 항만에서 대기하거나(체선) 화물이 반출되지 못하고 쌓이는(체화) 상태입니다.",
    long: "체선은 접안을 기다리는 선박, 체화는 터미널에 머무는 화물을 가리킵니다. 정해진 무료 기간을 넘기면 하루 단위로 비용이 붙기 때문에, 항만이 막히면 운임과 별개로 부대비용이 불어납니다.",
  },
  {
    term: "리플래깅",
    category: "operation",
    aliases: ["reflagging", "편의치적", "선적 변경"],
    short: "선박의 등록 국가(선적)를 다른 나라로 바꾸는 것입니다.",
    long: "세금·규제·선원 요건이나 분쟁 지역 통항 위험 때문에 선적을 옮깁니다. 특정 항로에서 리플래깅이 늘어난다면 그 항로의 운항 여건이 달라지고 있다는 신호로 읽을 수 있습니다.",
  },
];

/** 용어 또는 별칭으로 찾는다. 대소문자를 가리지 않는다. */
export function findTerm(query: string): GlossaryEntry | undefined {
  const q = query.trim().toLocaleLowerCase("ko-KR");
  if (!q) return undefined;
  return GLOSSARY.find(
    (e) =>
      e.term.toLocaleLowerCase("ko-KR") === q ||
      e.aliases?.some((a) => a.toLocaleLowerCase("ko-KR") === q),
  );
}

/** /glossary 의 앵커. 한글 용어도 URL에 쓸 수 있게 인코딩한다. */
export function termAnchor(term: string): string {
  return encodeURIComponent(term);
}

/** 검색어로 거른다(용어·별칭·설명 전부 대상). 비면 전체. */
export function searchGlossary(query: string): GlossaryEntry[] {
  const q = query.trim().toLocaleLowerCase("ko-KR");
  if (!q) return GLOSSARY;
  return GLOSSARY.filter((e) =>
    [e.term, e.short, e.long, ...(e.aliases ?? [])]
      .join(" ")
      .toLocaleLowerCase("ko-KR")
      .includes(q),
  );
}

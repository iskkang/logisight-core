// 물류 허브 좌표 사전 + 지연 segment 분류 resolver.
// 좌표는 큐레이션된 고정값만 사용. 인식 가능한 도시/구간/시설명은 적절히 분류하고,
// 정말 알 수 없는 값만 unmapped로 둔다(지도에 가짜 위치 금지).
import {
  congestionSeverity,
  disruptionLevelToSeverity,
  worstSeverity,
  SEVERITY_META,
  type Severity,
} from "@/lib/congestion";

type LngLat = [number, number];
type Precision = "exact" | "city" | "hub";

// 라벨 정규화 — 대소문자·공백·구두점·발음기호 제거, 한글 자모 재결합, 한자(CJK)·폴란드어 ł 보존/치환.
function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/ł/g, "l") // Małaszewicze → malaszewicze
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .normalize("NFC") // NFD가 분해한 한글을 가-힣로 복원
    .replace(/[^a-z0-9가-힣一-鿿]/g, "");
}

// 도시 좌표 [lng, lat] + 국가 + 한/영/현지/한자 별칭. hub=철도 국경·환적 거점.
const CITIES: { coords: LngLat; country: string; hub?: boolean; aliases: string[] }[] = [
  // 한국·중국 출발/내륙 허브
  { coords: [129.0756, 35.1796], country: "대한민국", aliases: ["Busan", "부산"] },
  { coords: [126.7052, 37.4563], country: "대한민국", aliases: ["Incheon", "인천"] },
  { coords: [120.3826, 36.0671], country: "중국", aliases: ["Qingdao", "Qing Dao", "칭다오", "청도", "青岛"] },
  { coords: [119.1606, 34.5967], country: "중국", aliases: ["Lianyungang", "롄윈강", "연운항", "连云港"] },
  { coords: [108.948, 34.2632], country: "중국", aliases: ["Xian", "Xi'an", "시안", "서안", "西安"] },
  { coords: [121.1306, 31.4514], country: "중국", aliases: ["Taicang", "타이창", "太仓"] },
  { coords: [120.0755, 29.3068], country: "중국", aliases: ["Yiwu", "이우", "义乌"] },
  { coords: [104.0668, 30.5728], country: "중국", aliases: ["Chengdu", "청두", "成都"] },
  { coords: [113.6254, 34.7466], country: "중국", aliases: ["Zhengzhou", "정저우", "郑州"] },
  { coords: [87.6168, 43.8256], country: "중국", aliases: ["Urumqi", "우루무치", "乌鲁木齐"] },
  { coords: [75.9938, 39.4704], country: "중국(신장)", aliases: ["Kashgar", "Kashi", "카슈가르", "喀什"] },
  // 국경·환적 (hub)
  { coords: [131.8855, 43.1155], country: "러시아", aliases: ["Vladivostok", "VVO", "블라디보스토크"] },
  { coords: [82.4844, 45.2517], country: "카자흐스탄", hub: true, aliases: ["Dostyk", "도스틱"] },
  { coords: [80.8847, 44.1932], country: "카자흐스탄", hub: true, aliases: ["Altynkol", "알틴콜"] },
  { coords: [80.4011, 44.2076], country: "중국(신장)", hub: true, aliases: ["Khorgos", "Horgos", "호르고스", "霍尔果斯"] },
  { coords: [69.1667, 41.4667], country: "카자흐스탄", hub: true, aliases: ["Saryagash", "Saryagach", "Sary-Agach", "사리아가시", "Сарыағаш"] },
  { coords: [82.9346, 55.0084], country: "러시아", aliases: ["Novosibirsk", "노보시비르스크"] },
  { coords: [80.2275, 50.4111], country: "카자흐스탄", aliases: ["Semey", "세메이"] },
  { coords: [78.9333, 52.5667], country: "러시아", hub: true, aliases: ["Kulunda", "쿨룬다", "Кулунда"] },
  { coords: [113.4994, 52.0515], country: "러시아", aliases: ["Chita", "치타"] },
  { coords: [60.6122, 56.8389], country: "러시아", aliases: ["Yekaterinburg", "예카테린부르크"] },
  { coords: [69.5901, 42.3417], country: "카자흐스탄", aliases: ["Shymkent", "심켄트"] },
  { coords: [71.4704, 51.1605], country: "카자흐스탄", aliases: ["Astana", "아스타나", "누르술탄"] },
  // 도착·소비지
  { coords: [76.8897, 43.2389], country: "카자흐스탄", aliases: ["Almaty", "알마티"] },
  { coords: [74.5698, 42.8746], country: "키르기스스탄", aliases: ["Bishkek", "비슈케크"] },
  { coords: [72.8161, 40.5139], country: "키르기스스탄", aliases: ["Osh", "오시"] },
  { coords: [72.3442, 40.7821], country: "우즈베키스탄", aliases: ["Andijan", "Andijon", "안디잔"] },
  {
    coords: [69.2401, 41.2995],
    country: "우즈베키스탄",
    hub: true,
    aliases: ["Tashkent", "타슈켄트", "Chukursay", "Chukursaj", "Chukursai", "추쿠르사이", "Чукурсай"],
  },
  { coords: [37.6173, 55.7558], country: "러시아", aliases: ["Moscow", "모스크바"] },
  { coords: [30.3351, 59.9343], country: "러시아", aliases: ["Saint Petersburg", "St Petersburg", "SPB", "상트페테르부르크", "Санкт-Петербург"] },
  { coords: [20.4522, 54.7104], country: "러시아", aliases: ["Kaliningrad", "칼리닌그라드", "Калининград"] },
  { coords: [27.559, 53.9006], country: "벨라루스", aliases: ["Minsk", "민스크"] },
  { coords: [30.4256, 54.5081], country: "벨라루스", aliases: ["Orsha", "오르샤"] },
  { coords: [23.7341, 52.0976], country: "벨라루스", aliases: ["Brest", "브레스트"] },
  { coords: [23.6889, 52.1109], country: "폴란드", aliases: ["Malaszewicze", "Malaszewice", "마와셰비체"] },
  { coords: [21.0122, 52.2297], country: "폴란드", aliases: ["Warsaw", "바르샤바"] },
  { coords: [19.4585, 51.7592], country: "폴란드", aliases: ["Lodz", "우치"] },
  { coords: [6.7735, 51.2277], country: "독일", aliases: ["Duisburg", "뒤스부르크"] },
  { coords: [9.9937, 53.5511], country: "독일", aliases: ["Hamburg", "함부르크"] },
];

type CityMeta = { coords: LngLat; country: string; precision: Precision };
const META_MAP = new Map<string, CityMeta>();
for (const c of CITIES)
  for (const a of c.aliases)
    META_MAP.set(norm(a), { coords: c.coords, country: c.country, precision: c.hub ? "hub" : "city" });

export function cityMeta(label: string): CityMeta | null {
  if (!label) return null;
  return META_MAP.get(norm(label)) ?? null;
}

// 동명(ambiguous) 위치 — 맥락(노선/국가)이 분명할 때만 해석. 없으면 '좌표 확인 필요'.
const AMBIGUOUS: Record<string, { name: string; candidates: { coords: LngLat; country: string; hints: string[] }[] }> = {
  [norm("Aksu")]: {
    name: "Aksu",
    candidates: [
      {
        coords: [80.2608, 41.1664],
        country: "중국(신장)",
        hints: ["china", "중국", "xinjiang", "신장", "kashgar", "카슈가르", "kashi", "qingdao", "칭다오", "xian", "시안", "urumqi", "우루무치", "korla"],
      },
    ],
  },
};

function isAmbiguousName(name: string): boolean {
  return !!AMBIGUOUS[norm(name)];
}

// 시설/회사 문자열에서 도시 토큰 추출(예: "Taicang tiger cntr service Co." → Taicang).
function facilityMatch(name: string): { city: string; meta: CityMeta } | null {
  const tokens = name.split(/[\s,./()\-_|]+/).map((t) => t.trim()).filter(Boolean);
  for (const t of tokens) {
    const m = cityMeta(t);
    if (m) return { city: t, meta: m };
  }
  for (let i = 0; i < tokens.length - 1; i++) {
    const bg = `${tokens[i]} ${tokens[i + 1]}`;
    const m = cityMeta(bg);
    if (m) return { city: bg, meta: m };
  }
  return null;
}

// 구간 구분자(화살표/ to /공백-하이픈-공백). 도시명 내부 하이픈(Sary-Agach)은 분리하지 않음.
function splitCorridor(name: string): [string, string] | null {
  const parts = name
    .split(/\s*(?:→|->|—|–|~)\s*|\s+to\s+|\s+-\s+/i)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length >= 2) return [parts[0], parts[parts.length - 1]];
  return null;
}

type ResolvedPoint = {
  lng: number;
  lat: number;
  country?: string;
  precision: Precision;
  via: "direct" | "facility" | "context";
  matchedCity?: string;
};

function resolvePoint(raw: string, ctx: string): ResolvedPoint | null {
  const direct = cityMeta(raw);
  if (direct) return { lng: direct.coords[0], lat: direct.coords[1], country: direct.country, precision: direct.precision, via: "direct" };
  const amb = AMBIGUOUS[norm(raw)];
  if (amb) {
    const nctx = norm(ctx);
    const hit = amb.candidates.find((c) => c.hints.some((h) => nctx.includes(norm(h))));
    if (hit) return { lng: hit.coords[0], lat: hit.coords[1], country: hit.country, precision: "city", via: "context", matchedCity: amb.name };
    return null; // 맥락 부족 → 호출부에서 ambiguous 처리
  }
  const fac = facilityMatch(raw);
  if (fac) return { lng: fac.meta.coords[0], lat: fac.meta.coords[1], country: fac.meta.country, precision: "city", via: "facility", matchedCity: fac.city };
  return null;
}

// ── 분류 결과 타입 ─────────────────────────────────────────────────
export type ResolvedDelayLocation =
  | { type: "location"; name: string; lat: number; lng: number; country?: string; precision: Precision }
  | { type: "corridor"; name: string; from: string; to: string; fromCoords: { lat: number; lng: number }; toCoords: { lat: number; lng: number }; displayMode: "segment" }
  | { type: "facility_city_match"; name: string; matchedCity: string; lat: number; lng: number; country?: string; precision: "city" }
  | { type: "partial"; name: string; resolvedPart: string; unresolvedPart: string; lat: number; lng: number; note: string }
  | { type: "ambiguous"; name: string; reason: string }
  | { type: "unmapped"; name: string; reason: string };

export function resolveDelayLocation(rawName: string, ctx = ""): ResolvedDelayLocation {
  const name = (rawName ?? "").trim();
  if (!name) return { type: "unmapped", name: rawName ?? "", reason: "빈 값" };

  const split = splitCorridor(name);
  if (split) {
    const [a, b] = split;
    const pa = resolvePoint(a, ctx);
    const pb = resolvePoint(b, ctx);
    if (pa && pb)
      return { type: "corridor", name, from: a, to: b, fromCoords: { lng: pa.lng, lat: pa.lat }, toCoords: { lng: pb.lng, lat: pb.lat }, displayMode: "segment" };
    if (pa) return { type: "partial", name, resolvedPart: a, unresolvedPart: b, lng: pa.lng, lat: pa.lat, note: "한쪽 끝점만 좌표 확인됨" };
    if (pb) return { type: "partial", name, resolvedPart: b, unresolvedPart: a, lng: pb.lng, lat: pb.lat, note: "한쪽 끝점만 좌표 확인됨" };
    return { type: "unmapped", name, reason: "양쪽 끝점 미확인" };
  }

  const p = resolvePoint(name, ctx);
  if (p) {
    if (p.via === "facility")
      return { type: "facility_city_match", name, matchedCity: p.matchedCity ?? name, lng: p.lng, lat: p.lat, country: p.country, precision: "city" };
    return { type: "location", name, lng: p.lng, lat: p.lat, country: p.country, precision: p.precision };
  }
  if (isAmbiguousName(name)) return { type: "ambiguous", name, reason: "동명 지역 — 노선·국가 맥락 부족" };
  return { type: "unmapped", name, reason: "미확인 위치" };
}

// ── 집계 출력 ──────────────────────────────────────────────────────
type Metrics = {
  delayDays: number;
  severity: Severity;
  affectedCount: number;
  relatedRoutes: string[];
  lastUpdated: string | null;
};

export type DelayHotspot = Metrics & {
  id: string;
  name: string;
  country?: string;
  lng: number;
  lat: number;
  precision: Precision;
  matchedCity?: string; // facility_city_match일 때 원본 segment는 originalSegment
  originalSegment?: string;
};
export type CorridorDelay = Metrics & {
  id: string;
  name: string;
  from: string;
  to: string;
  fromLng: number;
  fromLat: number;
  toLng: number;
  toLat: number;
  midLng: number;
  midLat: number;
};
export type PartialDelay = Metrics & {
  id: string;
  name: string;
  resolvedPart: string;
  unresolvedPart: string;
  lng: number;
  lat: number;
  note: string;
};
export type LabeledDelay = Metrics & { id: string; name: string; reason: string };

export type HotspotBuild = {
  hotspots: DelayHotspot[];
  corridors: CorridorDelay[];
  partial: PartialDelay[];
  ambiguous: LabeledDelay[];
  unmapped: LabeledDelay[];
};

type DisruptionInput = {
  segment: string;
  delay_contribution_days: number | null;
  severity: "high" | "medium" | "low";
  lane_id: string | null;
  started_at?: string | null;
  status?: string;
};

export function buildDelayHotspots(
  disruptions: DisruptionInput[],
  laneNameById: Map<string, string>,
): HotspotBuild {
  type Group = {
    name: string;
    days: number[];
    severity: Severity;
    laneIds: Set<string>;
    routes: Set<string>;
    updated: string | null;
    count: number;
  };
  const groups = new Map<string, Group>();

  for (const d of disruptions) {
    if (d.status && d.status !== "active") continue;
    const seg = (d.segment ?? "").trim();
    if (!seg) continue;
    const key = norm(seg) || seg;
    let g = groups.get(key);
    if (!g) {
      g = { name: seg, days: [], severity: "normal", laneIds: new Set(), routes: new Set(), updated: null, count: 0 };
      groups.set(key, g);
    }
    g.count += 1;
    if (d.delay_contribution_days != null) g.days.push(Math.max(0, d.delay_contribution_days));
    g.severity = worstSeverity(g.severity, disruptionLevelToSeverity(d.severity));
    if (d.lane_id) {
      g.laneIds.add(d.lane_id);
      const nm = laneNameById.get(d.lane_id);
      if (nm) g.routes.add(nm);
    }
    if (d.started_at && (!g.updated || d.started_at > g.updated)) g.updated = d.started_at;
  }

  const out: HotspotBuild = { hotspots: [], corridors: [], partial: [], ambiguous: [], unmapped: [] };

  for (const [key, g] of groups) {
    const delayDays = g.days.length ? Math.round(Math.max(...g.days) * 10) / 10 : 0;
    const severity = worstSeverity(congestionSeverity(delayDays) ?? "normal", g.severity);
    const metrics: Metrics = {
      delayDays,
      severity,
      affectedCount: g.laneIds.size > 0 ? g.laneIds.size : g.count,
      relatedRoutes: [...g.routes],
      lastUpdated: g.updated,
    };
    const r = resolveDelayLocation(g.name, [...g.routes].join(" "));
    switch (r.type) {
      case "location":
        out.hotspots.push({ id: key, name: r.name, country: r.country, lng: r.lng, lat: r.lat, precision: r.precision, ...metrics });
        break;
      case "facility_city_match":
        out.hotspots.push({ id: key, name: r.matchedCity, originalSegment: r.name, matchedCity: r.matchedCity, country: r.country, lng: r.lng, lat: r.lat, precision: "city", ...metrics });
        break;
      case "corridor":
        out.corridors.push({
          id: key,
          name: r.name,
          from: r.from,
          to: r.to,
          fromLng: r.fromCoords.lng,
          fromLat: r.fromCoords.lat,
          toLng: r.toCoords.lng,
          toLat: r.toCoords.lat,
          midLng: (r.fromCoords.lng + r.toCoords.lng) / 2,
          midLat: (r.fromCoords.lat + r.toCoords.lat) / 2,
          ...metrics,
        });
        break;
      case "partial":
        out.partial.push({ id: key, name: r.name, resolvedPart: r.resolvedPart, unresolvedPart: r.unresolvedPart, lng: r.lng, lat: r.lat, note: r.note, ...metrics });
        break;
      case "ambiguous":
        out.ambiguous.push({ id: key, name: r.name, reason: r.reason, ...metrics });
        break;
      default:
        out.unmapped.push({ id: key, name: r.name, reason: r.reason, ...metrics });
    }
  }

  const byDelay = (a: Metrics, b: Metrics) =>
    b.delayDays - a.delayDays || SEVERITY_META[b.severity].rank - SEVERITY_META[a.severity].rank;
  out.hotspots.sort(byDelay);
  out.corridors.sort(byDelay);
  out.partial.sort(byDelay);
  out.ambiguous.sort(byDelay);
  out.unmapped.sort(byDelay);
  return out;
}

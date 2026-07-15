# 속도 개선 이니셔티브 (설계)

- 날짜: 2026-07-15
- 범위: 프론트 성능(logisight-core). 순차 배치(A→B→C→D), 각 배치 개별 스펙·구현·배포.

## 진단 (측정값)

- OG 이미지 `og-default.png` = **1.4MB, 1055×1491 세로**(대시보드 스크린샷) — 전 페이지 og/twitter 기본값. OG 규격(1200×630)과 불일치.
- `vercel.json` 캐시 헤더 없음 → 정적 이미지 Vercel 기본(max-age=0).
- 라우터 `defaultPreload` 미설정 → hover 프리로드 없음(내비 시 데이터 대기).
- 무거운 라이브러리(maplibre 1.5MB·leaflet·recharts·maps)는 이미 **라우트별 청크 분리** — 홈/뉴스 번들 미포함.
- 뉴스 로더는 `latestNews`만 로드(대시보드 데이터 미로딩). 홈만 8개 쿼리(홈에 필요).
- `embla·vaul·cmdk·sonner·calendar·menubar·resizable·input-otp` 등은 `ui/*` 스캐폴드에서만 참조 → 실사용 여부 audit 필요.

## 배치 분해

### 배치 A — 정적 자산 즉효 (이 배치) ✅
- **#6 OG 이미지**: 스크린샷 상단(로고·티커·히어로·상단 카드)을 1200×630 크롭 → JPEG q82. `og-default.jpg` **88KB**(<300KB). 참조 3곳(seo.ts·__root.tsx og:image/twitter:image) 갱신, 기존 png 삭제.
- **#7 정적 이미지 장기 캐시**: `vercel.json` headers — 안정 대형 자산(hero webp·og jpg·world-map.svg·ad png·대형 hero png)에 `public, max-age=31536000, immutable`. favicon류는 변경 잦아 제외.

### 배치 B — CDN 캐싱 & SWR (#1·2·3)
- 동일-화면 라우트(홈·뉴스·리포트 등, 개인화 없음)에 문서/데이터 응답 `Cache-Control: s-maxage + stale-while-revalidate`(CDN SWR/ISR 유사).
- 서버 함수(createServerFn) 결과 캐싱(TTL). admin·개인화 경로 제외.
- 배포 후 캐시 동작 관찰 필요.

### 배치 C — 내비 체감 & 데이터 경계 (#8·9·4)
- `defaultPreload: 'intent'` + pending 최소화 → 이동 시 로딩 화면 감소.
- 뉴스 등에서 대시보드 데이터 미로딩 재검증, 필요 시 트림.
- 홈/뉴스 번들에 heavy lib 없음 재검증.

### 배치 D — 번들 위생 (#5)
- 미사용 라이브러리·`ui/*` 스캐폴드 audit 후 제거.

## 성공 기준 (배치 A)

- `og-default.jpg` < 300KB, 1200×630, 전 페이지 og:image/twitter:image로 노출.
- `vercel.json` 유효 JSON, 대형 정적 이미지에 immutable 장기 캐시 헤더.
- 빌드·SSR 정상, `.png` OG 참조 잔존 없음.

## 제약 준수 (CLAUDE.md)

- 라이브러리 교체 금지 → OG 재인코딩은 `npx sharp-cli`(영구 의존성 추가 없음).
- 개인화 없음 → 캐싱(B) 시 사용자별 데이터 없음 전제 유지.
- 기능 회귀 금지 → 자산·헤더 변경만, 로직 무변경.

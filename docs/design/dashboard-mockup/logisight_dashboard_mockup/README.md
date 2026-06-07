# Logisight Dashboard Mockup

구성 파일:

- `logisight-dashboard-mockup.html` — 브라우저에서 바로 확인하는 정적 HTML
- `LogisightDashboardMockup.tsx` — React / Next.js / Vite용 컴포넌트
- `LogisightDashboardMockup.css` — 공통 스타일시트
- `assets/container-ship-hero.png` — 헤더 배경 이미지

## HTML 확인

ZIP 압축을 푼 뒤 `logisight-dashboard-mockup.html`을 브라우저에서 열면 됩니다.

## React/Next 적용

컴포넌트와 CSS를 같은 폴더에 두고 아래처럼 사용하세요.

```tsx
import LogisightDashboardMockup from "./LogisightDashboardMockup";

export default function DashboardPage() {
  return <LogisightDashboardMockup />;
}
```

헤더 배경 이미지는 CSS에서 `./assets/container-ship-hero.png`를 참조합니다. 프로젝트 구조가 다르면 CSS의 `.ld-hero` `background-image` 경로만 수정하면 됩니다.

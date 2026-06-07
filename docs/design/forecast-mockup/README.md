# Logisight Forecast Mockup

구성 파일:

1. `logisight-forecast-mockup.html`
   - 브라우저에서 바로 열 수 있는 단일 HTML 파일입니다.
   - CSS가 내부에 포함되어 있어 별도 세팅 없이 확인 가능합니다.

2. `LogisightForecastMockup.tsx`
   - React / Next.js 프로젝트에 붙일 수 있는 컴포넌트입니다.

3. `LogisightForecastMockup.css`
   - TSX 컴포넌트에서 import하는 CSS 파일입니다.

## Next.js 사용 예시

```tsx
import LogisightForecastMockup from "@/components/LogisightForecastMockup";

export default function ForecastPage() {
  return <LogisightForecastMockup />;
}
```

CSS 파일은 TSX와 같은 폴더에 두거나, 프로젝트 구조에 맞게 import 경로를 수정하세요.

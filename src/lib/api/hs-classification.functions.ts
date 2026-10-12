import { createServerFn } from "@tanstack/react-start";

import { logHsQuery } from "@/server/hs-query-log";
// 분류 본체는 여기 있었지만 server/classify-hs-core.ts 로 옮겼다 ★
// 같은 파이프라인이 두 벌 있었다. 화면은 이 파일 것을, 정확도 측정기
// (/api/customs/e2e)는 classify-hs-core.ts 의 축약본을 돌리고 있어서, 측정값이
// 이용자가 실제로 받는 코드의 것이 아니었다. 이 파일 구현을 정본으로 삼아
// 한 벌로 합쳤다 —— 동작은 그대로고 위치만 바뀌었다.
import { classifyHsProductCore } from "@/server/classify-hs-core";

import {
  buildInsufficientInformationResult,
  hsClassificationInputSchema,
  type HsClassificationResult,
} from "@/server/hs-classification";

export const classifyHsProduct = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => hsClassificationInputSchema.parse(input))
  .handler(async ({ data }): Promise<HsClassificationResult> => {
    // 조회를 한 줄 남긴다. 이 도구는 지금 사용 기록이 없어 "쓰이고 있나"에 답할
    // 수가 없었다. logHsQuery 는 어떤 오류도 삼키므로 기록 실패가 조회 실패가
    // 되지 않는다. LLM 호출이 수 초 걸리므로 insert 한 번의 지연은 무시할 만하다.
    const startedAt = Date.now();
    try {
      const result = await classifyHsProductCore(data);
      await logHsQuery(data, result, Date.now() - startedAt, null);
      return result;
    } catch (error) {
      await logHsQuery(data, null, Date.now() - startedAt, error);
      throw error;
    }
  });

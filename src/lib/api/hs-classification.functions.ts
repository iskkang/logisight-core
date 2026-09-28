import { createServerFn } from "@tanstack/react-start";

import {
  buildInsufficientInformationResult,
  hsClassificationInputSchema,
  type HsClassificationResult,
} from "@/server/hs-classification";

export const classifyHsProduct = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => hsClassificationInputSchema.parse(input))
  .handler(async ({ data }): Promise<HsClassificationResult> => {
    // Phase 1 deliberately refuses to invent an HS code.
    // Candidate generation is enabled only after an official nomenclature
    // retrieval layer is connected, so every candidate can be checked against
    // a real heading/subheading and later against classification decisions.
    return buildInsufficientInformationResult(data);
  });

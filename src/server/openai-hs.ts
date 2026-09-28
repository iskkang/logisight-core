import { z } from "zod";

import type { HsClassificationInput } from "@/server/hs-classification";

const productAnalysisSchema = z.object({
  normalizedName: z.string(),
  material: z.string().nullable(),
  composition: z.string().nullable(),
  intendedUse: z.string().nullable(),
  form: z.string().nullable(),
  searchConceptsEs: z.array(z.string()).min(1).max(8),
  missingInformation: z.array(z.string()).max(8),
  followUpQuestions: z.array(z.string()).max(8),
});

export type ProductAnalysis = z.infer<typeof productAnalysisSchema>;

const jsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "normalizedName", "material", "composition", "intendedUse", "form",
    "searchConceptsEs", "missingInformation", "followUpQuestions",
  ],
  properties: {
    normalizedName: { type: "string" },
    material: { type: ["string", "null"] },
    composition: { type: ["string", "null"] },
    intendedUse: { type: ["string", "null"] },
    form: { type: ["string", "null"] },
    searchConceptsEs: { type: "array", minItems: 1, maxItems: 8, items: { type: "string" } },
    missingInformation: { type: "array", maxItems: 8, items: { type: "string" } },
    followUpQuestions: { type: "array", maxItems: 8, items: { type: "string" } },
  },
} as const;

export async function analyzeProductForEuCn(input: HsClassificationInput): Promise<ProductAnalysis> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_HS_MODEL || "gpt-5.6",
      instructions: [
        "You extract product characteristics for EU customs classification.",
        "Do not output, guess, or recommend any HS/CN/TARIC code.",
        "The application will retrieve codes only from its official CN database.",
        "Generate short Spanish customs-nomenclature search concepts because the current official CN descriptions are Spanish.",
        "If classification-critical facts are missing, identify them and ask concise Korean follow-up questions.",
      ].join(" "),
      input: JSON.stringify(input),
      text: {
        format: {
          type: "json_schema",
          name: "eu_cn_product_analysis",
          strict: true,
          schema: jsonSchema,
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI product analysis failed: ${response.status}`);
  }

  const payload = await response.json() as {
    status?: string;
    output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>;
  };
  if (payload.status && payload.status !== "completed") {
    throw new Error(`OpenAI product analysis incomplete: ${payload.status}`);
  }

  const text = payload.output
    ?.flatMap((item) => item.content ?? [])
    .find((item) => item.type === "output_text")?.text;
  if (!text) throw new Error("OpenAI returned no structured product analysis");

  return productAnalysisSchema.parse(JSON.parse(text));
}

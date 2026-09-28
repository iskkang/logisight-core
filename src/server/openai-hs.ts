import { z } from "zod";

import type { HsClassificationInput } from "@/server/hs-classification";

const productAnalysisSchema = z.object({
  normalizedName: z.string(),
  material: z.string().nullable(),
  composition: z.string().nullable(),
  intendedUse: z.string().nullable(),
  form: z.string().nullable(),
  searchConceptsEs: z.array(z.string()).min(1).max(8),
  hs4Candidates: z.array(z.string().regex(/^\d{4}$/)).min(1).max(3),
  missingInformation: z.array(z.string()).max(8),
  followUpQuestions: z.array(z.string()).max(8),
});

export type ProductAnalysis = z.infer<typeof productAnalysisSchema>;

const jsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "normalizedName", "material", "composition", "intendedUse", "form",
    "searchConceptsEs", "hs4Candidates", "missingInformation", "followUpQuestions",
  ],
  properties: {
    normalizedName: { type: "string" },
    material: { type: ["string", "null"] },
    composition: { type: ["string", "null"] },
    intendedUse: { type: ["string", "null"] },
    form: { type: ["string", "null"] },
    searchConceptsEs: { type: "array", minItems: 1, maxItems: 8, items: { type: "string" } },
    hs4Candidates: { type: "array", minItems: 1, maxItems: 3, items: { type: "string", pattern: "^\\d{4}$" } },
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
        "Identify up to three plausible 4-digit HS headings as a retrieval scope, but never output an 8-digit CN or 10-digit TARIC code.",
        "The application will retrieve final candidate codes only from its official CN database.",
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


const candidateSelectionSchema = z.object({
  selectedCodes: z.array(z.string().regex(/^\d{8}$/)).max(3),
  abstain: z.boolean(),
  rationaleKo: z.array(z.string()).min(1).max(5),
});

export async function rankOfficialEuCnCandidates(
  input: HsClassificationInput,
  analysis: ProductAnalysis,
  candidates: Array<{ code: string; description: string }>,
) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");

  const allowedCodes = new Set(candidates.map((candidate) => candidate.code));
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_HS_MODEL || "gpt-5.6",
      instructions: [
        "You are ranking ONLY the official EU CN8 candidates supplied by the application.",
        "Never invent a code and never select a code outside the supplied candidates.",
        "Compare product use, form, composition and retail presentation against each candidate description.",
        "Exclude candidates that plainly contradict the product facts.",
        "If the supplied facts do not support a defensible shortlist, abstain.",
        "Return concise Korean reasons. Do not claim this is a binding customs ruling.",
      ].join(" "),
      input: JSON.stringify({ product: input, analysis, officialCandidates: candidates }),
      text: { format: {
        type: "json_schema", name: "eu_cn_candidate_selection", strict: true,
        schema: {
          type: "object", additionalProperties: false,
          required: ["selectedCodes", "abstain", "rationaleKo"],
          properties: {
            selectedCodes: { type: "array", maxItems: 3, items: { type: "string" } },
            abstain: { type: "boolean" },
            rationaleKo: { type: "array", minItems: 1, maxItems: 5, items: { type: "string" } },
          },
        },
      }},
    }),
  });
  if (!response.ok) throw new Error(`OpenAI candidate ranking failed: ${response.status}`);
  const payload = await response.json() as { output?: Array<{ content?: Array<{ type?: string; text?: string }> }> };
  const outputText = payload.output?.flatMap((item) => item.content ?? []).find((item) => item.type === "output_text")?.text;
  if (!outputText) throw new Error("OpenAI returned no candidate ranking");
  const parsed = candidateSelectionSchema.parse(JSON.parse(outputText));
  const selectedCodes = parsed.selectedCodes.filter((code) => allowedCodes.has(code));
  if (selectedCodes.length !== parsed.selectedCodes.length) throw new Error("Model selected a CN code outside the official candidate set");
  return { ...parsed, selectedCodes };
}

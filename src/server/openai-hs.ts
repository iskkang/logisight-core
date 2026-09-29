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
const jsonSchema = {type:"object",additionalProperties:false,required:["normalizedName","material","composition","intendedUse","form","searchConceptsEs","hs4Candidates","missingInformation","followUpQuestions"],properties:{normalizedName:{type:"string"},material:{type:["string","null"]},composition:{type:["string","null"]},intendedUse:{type:["string","null"]},form:{type:["string","null"]},searchConceptsEs:{type:"array",minItems:1,maxItems:8,items:{type:"string"}},hs4Candidates:{type:"array",minItems:1,maxItems:3,items:{type:"string",pattern:"^\\d{4}$"}},missingInformation:{type:"array",maxItems:8,items:{type:"string"}},followUpQuestions:{type:"array",maxItems:8,items:{type:"string"}}}} as const;

async function responseJson(body: unknown, schema: unknown, name: string) {
  const apiKey=process.env.OPENAI_API_KEY; if(!apiKey) throw new Error("OPENAI_API_KEY is not configured");
  const response=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:`Bearer ${apiKey}`,"Content-Type":"application/json"},body:JSON.stringify({model:process.env.OPENAI_HS_MODEL||"gpt-5.6",...body,text:{format:{type:"json_schema",name,strict:true,schema}}})});
  if(!response.ok) throw new Error(`OpenAI request failed: ${response.status}`);
  const payload=await response.json() as {status?:string;output?:Array<{content?:Array<{type?:string;text?:string}>}>};
  if(payload.status&&payload.status!=="completed") throw new Error(`OpenAI request incomplete: ${payload.status}`);
  const text=payload.output?.flatMap(x=>x.content??[]).find(x=>x.type==="output_text")?.text;
  if(!text) throw new Error("OpenAI returned no structured output");
  return JSON.parse(text);
}

export async function analyzeProductForEuCn(input: HsClassificationInput): Promise<ProductAnalysis> {
  return productAnalysisSchema.parse(await responseJson({instructions:["You extract product characteristics for EU customs classification.","Identify up to three plausible 4-digit HS headings as retrieval scope, never an 8-digit CN/TARIC code.","Generate short Spanish search concepts because the stored legal CN source may be Spanish.","If classification-critical facts are missing, ask concise Korean follow-up questions."].join(" "),input:JSON.stringify(input)},jsonSchema,"eu_cn_product_analysis"));
}

const selectionSchema=z.object({
  selectedCandidates:z.array(z.object({code:z.string().regex(/^\d{8}$/),displayNameKo:z.string().min(1)})).max(3),
  abstain:z.boolean(), rationaleKo:z.array(z.string()).min(1).max(5),
});

export async function rankOfficialEuCnCandidates(input:HsClassificationInput,analysis:ProductAnalysis,candidates:Array<{code:string;description:string}>) {
  const allowed=new Map(candidates.map(c=>[c.code,c.description]));
  const schema={type:"object",additionalProperties:false,required:["selectedCandidates","abstain","rationaleKo"],properties:{selectedCandidates:{type:"array",maxItems:3,items:{type:"object",additionalProperties:false,required:["code","displayNameKo"],properties:{code:{type:"string",pattern:"^\\d{8}$"},displayNameKo:{type:"string"}}}},abstain:{type:"boolean"},rationaleKo:{type:"array",minItems:1,maxItems:5,items:{type:"string"}}}};
  const parsed=selectionSchema.parse(await responseJson({instructions:["Rank ONLY the supplied official EU CN8 candidates.","Never invent or select a code outside the supplied candidates.","Compare use, form, composition and retail presentation.","If facts are insufficient, abstain.","For every selected code, provide a concise Korean display name faithfully translated from that candidate's supplied official description. Do not add legal meaning.","Return concise Korean reasons. Do not claim a binding customs ruling."].join(" "),input:JSON.stringify({product:input,analysis,officialCandidates:candidates})},schema,"eu_cn_candidate_selection"));
  for(const c of parsed.selectedCandidates) if(!allowed.has(c.code)) throw new Error("Model selected a CN code outside the official candidate set");
  return {...parsed,selectedCodes:parsed.selectedCandidates.map(c=>c.code),displayNamesKo:new Map(parsed.selectedCandidates.map(c=>[c.code,c.displayNameKo]))};
}

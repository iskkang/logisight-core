import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const url = process.env.TARIC_SOURCE_URL;
const sbUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !sbUrl || !serviceKey) throw new Error("TARIC_SOURCE_URL, SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");

const res = await fetch(url, { headers: { "user-agent": "Logisight-TARIC-Ingest/1.0" } });
if (!res.ok) throw new Error(`TARIC download failed: ${res.status} ${res.statusText}`);
const text = await res.text();
const rows = text.split(/\r?\n/).filter(Boolean);
if (rows.length < 2) throw new Error("TARIC source contains no data");

const delim = rows[0].includes(";") ? ";" : ",";
const headers = rows[0].split(delim).map(x => x.replace(/^"|"$/g,"").trim().toLowerCase());
const aliases = {
 code:["cn_code","commodity code","goods nomenclature item id","code"],
 type:["measure_type","measure type","measure type description"],
 rate:["rate_percent","duty rate","measure duty","rate"],
 origin:["origin_country","geographical area","country"],
 title:["title","measure type description","description"],
 legal:["legal_basis","regulation","legal base"],
};
const idx=(names)=>{ for(const n of names){const i=headers.indexOf(n);if(i>=0)return i;} return -1; };
const I=Object.fromEntries(Object.entries(aliases).map(([k,v])=>[k,idx(v)]));
if(I.code<0 || I.type<0) throw new Error(`Unsupported TARIC columns: ${headers.join(", ")}`);

const parse=(line)=>line.split(delim).map(x=>x.replace(/^"|"$/g,"").trim());
const normalizeType=(raw)=>{
 const v=raw.toLowerCase();
 if(v.includes("third country")) return "THIRD_COUNTRY_DUTY";
 if(v.includes("preference")) return "PREFERENCE";
 if(v.includes("restriction")||v.includes("requirement")||v.includes("control")) return "REQUIREMENT";
 return null;
};
const payload=[];
for(const line of rows.slice(1)){
 const c=parse(line); const type=normalizeType(c[I.type]||""); if(!type) continue;
 const code=(c[I.code]||"").replace(/\D/g,""); if(code.length<4) continue;
 const rawRate=I.rate>=0?c[I.rate]:""; const m=rawRate?.match(/([0-9]+(?:[.,][0-9]+)?)\s*%/);
 payload.push({cn_code:code,origin_country:I.origin>=0?(c[I.origin]||null):null,measure_type:type,
  rate_percent:m?Number(m[1].replace(",",".")):null,rate_text:rawRate||null,title:I.title>=0?(c[I.title]||type):type,
  legal_basis:I.legal>=0?(c[I.legal]||null):null,source_url:url,is_active:true,metadata:{source:"EU TARIC",ingested:new Date().toISOString()}});
}
if(!payload.length) throw new Error("No supported tariff measures parsed; refusing to overwrite production data");
const sb=createClient(sbUrl,serviceKey,{auth:{persistSession:false}});
const {error:delErr}=await sb.from("eu_customs_measures").delete().eq("metadata->>source","EU TARIC");
if(delErr) throw delErr;
for(let i=0;i<payload.length;i+=500){const {error}=await sb.from("eu_customs_measures").insert(payload.slice(i,i+500));if(error)throw error;}
console.log(JSON.stringify({source:url,rows:payload.length,thirdCountry:payload.filter(x=>x.measure_type==="THIRD_COUNTRY_DUTY").length,preferences:payload.filter(x=>x.measure_type==="PREFERENCE").length}));

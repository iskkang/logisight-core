import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

const sbUrl=process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL;
const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
const feed=process.env.EU_CLASS_EVIDENCE_URL;
if(!sbUrl||!key||!feed) throw new Error("SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and EU_CLASS_EVIDENCE_URL are required");
if(!/^https:\/\/(eur-lex\.europa\.eu|data\.europa\.eu)\//.test(feed)) throw new Error("Evidence source must be an official EU EUR-Lex/data.europa.eu URL");

const r=await fetch(feed,{headers:{"user-agent":"Logisight-EU-Legal-Evidence/1.0"}});
if(!r.ok) throw new Error(`Evidence download failed: ${r.status}`);
const body=await r.text();
const contentType=r.headers.get("content-type")||"";
let records=[];
if(contentType.includes("json")||feed.endsWith(".json")){
 const j=JSON.parse(body); records=Array.isArray(j)?j:(j.results||j.items||[]);
}else{
 const lines=body.split(/\r?\n/).filter(Boolean); const delim=(lines[0]||"").includes(";")?";":",";
 const h=(lines.shift()||"").split(delim).map(x=>x.replace(/^"|"$/g,"").trim().toLowerCase());
 const at=(row,names)=>{for(const n of names){const i=h.indexOf(n);if(i>=0)return row[i];}return null};
 records=lines.map(line=>{const row=line.split(delim).map(x=>x.replace(/^"|"$/g,"").trim());return {
  cn_code:at(row,["cn_code","cn code","commodity_code","commodity code"]),
  source_id:at(row,["source_id","celex","eli","id"]),
  title:at(row,["title","document_title","document title"]),
  product_description:at(row,["product_description","product description","goods_description"]),
  decision_summary:at(row,["decision_summary","summary","classification"]),
  legal_basis:at(row,["legal_basis","legal basis","basis"]),
  decision_date:at(row,["decision_date","date","document_date"]),
  source_url:at(row,["source_url","url","eli_url"]),
  source_type:at(row,["source_type","type"])||"CLASSIFICATION_REGULATION"
 }});
}
const allowed=new Set(["CN_EXPLANATORY_NOTE","CLASSIFICATION_REGULATION","CCC_CONCLUSION","CJEU"]);
const payload=records.map(x=>({
 market:"EU",cn_code:String(x.cn_code||"").replace(/\D/g,""),source_type:allowed.has(x.source_type)?x.source_type:"CLASSIFICATION_REGULATION",
 source_id:x.source_id||x.source_url,title:x.title||"EU customs classification evidence",product_description:x.product_description||null,
 decision_summary:x.decision_summary||null,legal_basis:x.legal_basis||null,decision_date:x.decision_date||null,
 source_url:x.source_url||feed,source_version:new Date().toISOString().slice(0,10),
 source_hash:crypto.createHash("sha256").update(JSON.stringify(x)).digest("hex"),is_active:true,metadata:{feed}
})).filter(x=>x.cn_code.length>=4&&/^https:\/\/(eur-lex\.europa\.eu|data\.europa\.eu)\//.test(x.source_url));
if(!payload.length) throw new Error("No valid official EU evidence parsed; refusing production mutation");
const sb=createClient(sbUrl,key,{auth:{persistSession:false}});
for(let i=0;i<payload.length;i+=250){const {error}=await sb.from("customs_classification_evidence").upsert(payload.slice(i,i+250),{onConflict:"source_type,source_id"});if(error)throw error;}
console.log(JSON.stringify({ingested:payload.length,feed}));

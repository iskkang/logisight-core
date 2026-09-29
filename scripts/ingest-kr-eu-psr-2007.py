#!/usr/bin/env python3
import os,re,requests
from bs4 import BeautifulSoup
from collections import defaultdict
from datetime import date

AGREEMENT_URL="https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:22011A0514(01)"
PROTOCOL_URL="https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:22011A0514(02)"
SOURCE_URL=PROTOCOL_URL

ROW_START=re.compile(r"^\s*((?:ex\s+)?Chapter\s+\d{1,2}|(?:ex\s+)?\d{4}(?:\s+\d{2})?(?:\s+to\s+\d{4}(?:\s+\d{2})?)?)\s{2,}")
CN8_RE=re.compile(r"(?<!\d)(\d{4})\s+(\d{2})\s+(\d{2})(?!\d)")
PCT_RE=re.compile(r"(?:does not exceed|not exceed)\s+(\d+(?:[.,]\d+)?)\s*%.*?ex-works",re.I|re.S)

PROCESS_WORDS=[
 "Manufacture","Spinning","Weaving","Knitting","Printing","Refining","Grinding",
 "Assembly","Embroidering","Coating","Making-up","Wholly obtained","All the materials",
 "A change","Production","Distillation","Chemical reaction","Mixing"
]

def clean(s):
    return re.sub(r"\s+"," ",s.replace("\u00ad","").replace("","")).strip()

def parse_selector(sel):
    raw=clean(sel)
    x=raw.lower().replace("ex ","")
    if x.startswith("chapter "):
        return [x.split()[1].zfill(2)], {"selector_type":"chapter","ex":raw.lower().startswith("ex ")}
    m=re.fullmatch(r"(\d{4})(?:\s+(\d{2}))?",x)
    if m:
        return [m.group(1)+(m.group(2) or "")], {"selector_type":"subheading" if m.group(2) else "heading","ex":raw.lower().startswith("ex ")}
    m=re.fullmatch(r"(\d{4})(?:\s+(\d{2}))?\s+to\s+(\d{4})(?:\s+(\d{2}))?",x)
    if m and not m.group(2) and not m.group(4):
        a,b=int(m.group(1)),int(m.group(3))
        if 0 <= b-a <= 100:
            return [f"{n:04d}" for n in range(a,b+1)], {"selector_type":"heading_range","ex":raw.lower().startswith("ex ")}
    return [], {"selector_type":"unparsed","ex":raw.lower().startswith("ex ")}

def extract_rule_text(block):
    flat=clean(block)
    starts=[flat.find(w) for w in PROCESS_WORDS if flat.find(w)>=0]
    if not starts: return flat
    return flat[min(starts):]

def rule_json(rule):
    r=clean(rule)
    low=r.lower()
    has_cth=("materials of any heading" in low and "except that of the product" in low)
    pct=PCT_RE.search(r)
    has_mc=bool(pct)
    if has_cth and has_mc:
        return {"type":"OR","rules":[{"type":"CTH"},{"type":"MC","maxPercent":float(pct.group(1).replace(",","."))}]}
    if has_cth:
        return {"type":"CTH"}
    if has_mc and ("value of all the materials used" in low or "value of all materials used" in low):
        return {"type":"MC","maxPercent":float(pct.group(1).replace(",","."))}
    if "chapter 61" in low or ("spinning" in low and "knitting" in low):
        return {"type":"TEXTILE_PROCESS","process":"CH61"}
    return {"type":"TEXT_RULE"}

def fetch_cn8(sb,key):
    out=[]; off=0
    h={"apikey":key,"Authorization":f"Bearer {key}"}
    while True:
        q=(f"{sb}/rest/v1/customs_nomenclature?select=code&market=eq.EU&nomenclature=eq.CN"
           f"&is_active=eq.true&level=eq.8&order=code.asc&offset={off}&limit=1000")
        r=requests.get(q,headers=h,timeout=60);r.raise_for_status(); batch=r.json()
        out += [re.sub(r"\D","",x["code"])[:8] for x in batch if x.get("code")]
        if len(batch)<1000: break
        off += 1000
    return sorted(set(x for x in out if len(x)==8))

def main():
    sb=os.environ["SUPABASE_URL"].rstrip("/"); key=os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    headers={"User-Agent":"Logisight-KR-EU-PSR/1.0"}
    ra=requests.get(AGREEMENT_URL,timeout=180,headers=headers); ra.raise_for_status()
    rp=requests.get(PROTOCOL_URL,timeout=180,headers=headers); rp.raise_for_status()
    if len(ra.text)<100000 or len(rp.text)<50000: raise RuntimeError("EUR-Lex HTML response unexpectedly small")
    agreement=BeautifulSoup(ra.text,"html.parser")
    protocol=BeautifulSoup(rp.text,"html.parser")

    # CN2007 tariff schedule is embedded in the official agreement HTML.
    agreement_text=agreement.get_text(" ",strip=True)
    old8=set("".join(m.groups()) for m in CN8_RE.finditer(agreement_text))

    # Parse Annex II table rows from the official rules-of-origin protocol.
    marker=None
    for node in protocol.find_all(string=True):
        if clean(str(node)).upper()=="ANNEX II":
            marker=node
    if marker is None: raise RuntimeError("Could not locate Annex II in protocol HTML")

    blocks=[]
    current=None
    seen=set()
    for el in marker.parent.find_all_next():
        txt=clean(el.get_text(" ",strip=True)) if hasattr(el,"get_text") else ""
        if txt.upper()=="ANNEX II(A)":
            break
        if getattr(el,"name",None)!="tr" or id(el) in seen:
            continue
        seen.add(id(el))
        cells=[clean(x.get_text(" ",strip=True)) for x in el.find_all(["td","th"],recursive=False)]
        if len(cells)<3: continue
        prefixes,meta=parse_selector(cells[0]) if cells[0] else ([],{})
        rulecols=[x for x in cells[2:] if x]
        if prefixes:
            if current: blocks.append(current)
            current={"selector":cells[0],"prefixes":prefixes,"meta":meta,"rules":rulecols}
        elif current and rulecols:
            # Continuation/sub-product rows under the same selector are retained.
            # Multiple divergent sub-rules intentionally become TEXT_RULE unless safely parseable.
            current["rules"].extend(rulecols)
    if current: blocks.append(current)

    psr=[]
    for b in blocks:
        rule=" OR ".join(dict.fromkeys(x for x in b["rules"] if x))
        if len(rule)<8: rule="Complex product-specific rule; see official Annex II text for the selector."
        parsed=rule_json(rule)
        for p in b["prefixes"]:
            psr.append({
              "agreement":"KR-EU FTA","hs_prefix":p,"hs_version":2007,
              "rule_code":parsed["type"],"rule_text_ko":"공식 한-EU FTA Annex II 품목별 원산지 기준",
              "rule_text_en":rule,"rule_json":parsed,"source_url":SOURCE_URL,
              "legal_basis":"EU-Korea FTA Protocol on Rules of Origin, Annex II",
              "valid_from":"2011-07-01","valid_to":None,"is_active":True,
              "selector_text":b["selector"],"metadata":{"source":"EUR-Lex OJ L127/2011","parser":"annexII-html-v2",**b["meta"]}
            })
    if len(psr)<150: raise RuntimeError(f"Only {len(psr)} PSR rows parsed; refusing mutation")
    old6=set(x[:6] for x in old8); old4=set(x[:4] for x in old8); old2=set(x[:2] for x in old8)
    if len(old8)<5000: raise RuntimeError(f"Only {len(old8)} CN2007 codes parsed; refusing mutation")

    cn8=fetch_cn8(sb,key)
    cross=[]
    for c in cn8:
        if c[:6] in old6:
            hs=c[:6]; typ="HS6_IDENTITY"
        elif c[:4] in old4:
            hs=c[:4]; typ="HS4_FAMILY"
        elif c[:2] in old2:
            hs=c[:2]; typ="CHAPTER_FAMILY"
        else:
            hs=None; typ="UNRESOLVED"
        cross.append({"cn2026_code":c,"hs2007_code":hs,"mapping_type":typ,"source_url":SOURCE_URL,
                      "is_active":True,"metadata":{"source":"CN2007 schedule in EU-Korea FTA OJ + CN2026 Logisight","conservative":typ!="HS6_IDENTITY"}})
    if len(cross)<9000: raise RuntimeError(f"Only {len(cross)} CN2026 rows; refusing mutation")

    h={"apikey":key,"Authorization":f"Bearer {key}","Content-Type":"application/json","Prefer":"return=minimal"}
    # Replace generated PSR rows, retain manually curated overrides.
    requests.delete(sb+"/rest/v1/eu_origin_rules?metadata->>source=eq.EUR-Lex%20OJ%20L127/2011",headers=h,timeout=60).raise_for_status()
    for i in range(0,len(psr),300):
        requests.post(sb+"/rest/v1/eu_origin_rules",headers=h,json=psr[i:i+300],timeout=60).raise_for_status()

    requests.delete(sb+"/rest/v1/eu_hs_crosswalk?cn2026_code=not.is.null",headers=h,timeout=60).raise_for_status()
    for i in range(0,len(cross),400):
        requests.post(sb+"/rest/v1/eu_hs_crosswalk",headers=h,json=cross[i:i+400],timeout=60).raise_for_status()

    counts=defaultdict(int)
    for x in cross: counts[x["mapping_type"]]+=1
    types=defaultdict(int)
    for x in psr: types[x["rule_json"]["type"]]+=1
    print("PSR rows",len(psr),"types",dict(types))
    print("Crosswalk",len(cross),dict(counts))

if __name__=="__main__": main()

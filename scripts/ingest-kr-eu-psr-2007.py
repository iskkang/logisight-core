#!/usr/bin/env python3
import os,re,requests,subprocess,tempfile,time,json
from bs4 import BeautifulSoup
from collections import defaultdict

PSR_PAGE="https://www.customs.go.kr/ftaportalkor/ad/ftaTrtyPsr/psr.do?mi=3528"
PSR_DATA="https://www.customs.go.kr/ftaportalkor/ad/ftaTrtyPsr/psrCategoryView.do"
CROSSWALK_URL="https://www.customs.go.kr/common/nttFileDownload.do?fileKey=baee47db73be787e49c4e253fc2f5c23"
SOURCE_NAME="KCS FTA Portal HS2007 PSR"
CROSS_SOURCE="KCS HS2022-HS2007 official crosswalk"
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36"

PCT=re.compile(r"(?:does not exceed|not exceed|no more than)\s+(\d+(?:[.,]\d+)?)\s*%.*?(?:ex-works|ex works)",re.I|re.S)
HS6PAIR=re.compile(r"^\s*(\d{6})\s+(\d{6})(?:\s|$)")

def clean(s):
    return re.sub(r"\s+"," ",str(s or "").replace("\u00a0"," ")).strip()

def parse_rule_json(ko,en):
    k=clean(ko); e=clean(en); low=e.lower()
    cth=("materials of any heading except that of the product" in low
         or "materials of any heading, except that of the product" in low
         or ("모든 호" in k and "그 제품의 호" in k and ("제외" in k or "빼고" in k)))
    cc=("materials of any chapter except that of the product" in low
        or ("모든 류" in k and "그 제품의 류" in k and "제외" in k))
    ctsh=("materials of any subheading except that of the product" in low
          or ("모든 소호" in k and "그 제품의 소호" in k and "제외" in k))
    pct=PCT.search(e)
    mc={"type":"MC","maxPercent":float(pct.group(1).replace(",","."))} if pct else None
    wholly=("wholly obtained" in low or "완전생산" in k)
    textile_ch61=(("spinning" in low or "extrusion" in low) and "knitting" in low and ("making up" in low or "cutting" in low))
    if textile_ch61:
        return {"type":"TEXTILE_CH61"}
    base=None
    if ctsh: base={"type":"CTSH"}
    elif cth: base={"type":"CTH"}
    elif cc: base={"type":"CC"}
    elif wholly: base={"type":"WO"}
    if base and mc:
        if re.search(r"\bor\b",low) or "또는" in k or "어느 하나" in k:
            return {"type":"OR","rules":[base,mc]}
        return {"type":"AND","rules":[base,mc]}
    if base: return base
    if mc: return mc
    return {"type":"TEXT_RULE"}

def parse_psr_chapter(session,chapter):
    r=session.post(PSR_DATA,data={"ftaId":"KOREU","nationId":"EU","searchType":"01","searchValue":chapter},timeout=90)
    r.raise_for_status()
    soup=BeautifulSoup(r.text,"html.parser")
    tables=[]
    for table in soup.find_all("table"):
        cap=clean(table.find("caption").get_text(" ",strip=True) if table.find("caption") else "")
        if "수출세율 조회" in cap:
            tables.append(table)
    out=[]
    for table in tables:
        pending=None
        for tr in table.find_all("tr"):
            cells=[clean(td.get_text(" ",strip=True)) for td in tr.find_all("td")]
            if not cells: continue
            if len(cells)>=4 and re.fullmatch(r"\d{6}",cells[0] or ""):
                if pending:
                    out.append(pending)
                pending={"hs":cells[0],"division":cells[1],"item_ko":cells[2],"rule_ko":cells[3],"item_en":"","rule_en":""}
            elif pending and len(cells)>=2:
                pending["item_en"]=cells[0]
                pending["rule_en"]=cells[1]
                out.append(pending); pending=None
        if pending: out.append(pending)
    return out

def fetch_all_psr():
    s=requests.Session(); s.headers.update({"User-Agent":UA,"Accept-Language":"ko-KR,ko;q=0.9,en;q=0.7"})
    rows=[]
    for n in range(1,98):
        ch=f"{n:02d}"
        try:
            got=parse_psr_chapter(s,ch)
        except Exception as e:
            raise RuntimeError(f"KCS PSR chapter {ch} failed: {e}")
        rows.extend(got)
        if n%10==0: print("PSR chapters",n,"rows",len(rows))
        time.sleep(0.03)
    # Deduplicate exact bilingual records.
    seen=set(); payload=[]
    for x in rows:
        key=(x["hs"],x["division"],x["item_ko"],x["rule_ko"],x["item_en"],x["rule_en"])
        if key in seen: continue
        seen.add(key)
        parsed=parse_rule_json(x["rule_ko"],x["rule_en"])
        payload.append({
          "agreement":"KR-EU FTA","hs_prefix":x["hs"],"hs_version":2007,
          "rule_code":parsed["type"],"rule_text_ko":x["rule_ko"] or "관세청 한-EU FTA 품목별 원산지결정기준",
          "rule_text_en":x["rule_en"] or None,"rule_json":parsed,"source_url":PSR_PAGE,
          "legal_basis":"EU-Korea FTA Protocol on Rules of Origin, Annex II",
          "is_active":True,"valid_from":"2011-07-01","valid_to":None,
          "selector_text":x["hs"] + (("/"+x["division"]) if x["division"] else ""),
          "metadata":{"source":SOURCE_NAME,"item_ko":x["item_ko"],"item_en":x["item_en"],"division":x["division"],"retrieval":"KCS psrCategoryView.do"}
        })
    return payload

def extract_crosswalk_pairs():
    r=requests.get(CROSSWALK_URL,headers={"User-Agent":UA},timeout=180); r.raise_for_status()
    if not r.content.startswith(b"%PDF"): raise RuntimeError("KCS crosswalk download is not PDF")
    with tempfile.TemporaryDirectory() as d:
        pdf=os.path.join(d,"crosswalk.pdf"); txt=os.path.join(d,"crosswalk.txt")
        open(pdf,"wb").write(r.content)
        subprocess.run(["pdftotext","-layout",pdf,txt],check=True,timeout=300)
        pairs=[]
        with open(txt,encoding="utf-8",errors="replace") as fh:
            for line in fh:
                m=HS6PAIR.match(line)
                if m: pairs.append((m.group(1),m.group(2)))
    pairs=sorted(set(pairs))
    return pairs

def fetch_cn8(sb,key):
    out=[]; off=0
    h={"apikey":key,"Authorization":f"Bearer {key}"}
    while True:
        q=(f"{sb}/rest/v1/customs_nomenclature?select=code&market=eq.EU&nomenclature=eq.CN"
           f"&is_active=eq.true&level=eq.8&order=code.asc&offset={off}&limit=1000")
        r=requests.get(q,headers=h,timeout=60); r.raise_for_status(); batch=r.json()
        out += [re.sub(r"\D","",x["code"])[:8] for x in batch if x.get("code")]
        if len(batch)<1000: break
        off += 1000
    return sorted(set(x for x in out if len(x)==8))

def main():
    sb=os.environ["SUPABASE_URL"].rstrip("/"); key=os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    psr=fetch_all_psr()
    hs6_rules=set(x["hs_prefix"] for x in psr)
    rule_types=defaultdict(int)
    for x in psr: rule_types[x["rule_code"]]+=1
    print("KCS PSR",len(psr),"HS6",len(hs6_rules),"types",dict(rule_types))
    if len(hs6_rules)<4500 or len(psr)<4500:
        raise RuntimeError(f"Only {len(psr)} rules / {len(hs6_rules)} HS6 parsed; refusing mutation")

    pairs=extract_crosswalk_pairs()
    by22=defaultdict(set)
    for h22,h07 in pairs: by22[h22].add(h07)
    print("KCS crosswalk pairs",len(pairs),"HS2022",len(by22))
    if len(pairs)<4500 or len(by22)<4000:
        raise RuntimeError("Crosswalk PDF parse too small; refusing mutation")

    cn8=fetch_cn8(sb,key)
    cross=[]
    unresolved=[]
    for c in cn8:
        h22=c[:6]
        olds=sorted(by22.get(h22,[]))
        if not olds:
            unresolved.append(c)
            continue
        for old in olds:
            cross.append({
              "cn2026_code":c,"hs2007_code":old,
              "mapping_type":"HS6_IDENTITY" if old==h22 else "KCS_HS2022_TO_HS2007",
              "source_url":CROSSWALK_URL,"is_active":True,
              "metadata":{"source":CROSS_SOURCE,"hs2022":h22,"one_to_many":len(olds)>1}
            })
    mapped_cn=len(set(x["cn2026_code"] for x in cross))
    print("CN8 crosswalk rows",len(cross),"mapped CN8",mapped_cn,"unresolved",len(unresolved))
    if mapped_cn < int(len(cn8)*0.90):
        raise RuntimeError(f"Only {mapped_cn}/{len(cn8)} CN8 mapped; refusing mutation")

    h={"apikey":key,"Authorization":f"Bearer {key}","Content-Type":"application/json","Prefer":"return=minimal"}

    # Replace only generated KCS rules. Retain hand-curated overrides.
    delurl=sb+"/rest/v1/eu_origin_rules?metadata->>source=eq."+requests.utils.quote(SOURCE_NAME,safe="")
    dr=requests.delete(delurl,headers=h,timeout=60); dr.raise_for_status()
    for i in range(0,len(psr),300):
        rr=requests.post(sb+"/rest/v1/eu_origin_rules",headers=h,json=psr[i:i+300],timeout=90); rr.raise_for_status()

    # Full official crosswalk snapshot.
    dr=requests.delete(sb+"/rest/v1/eu_hs_crosswalk?cn2026_code=not.is.null",headers=h,timeout=60); dr.raise_for_status()
    for i in range(0,len(cross),400):
        rr=requests.post(sb+"/rest/v1/eu_hs_crosswalk",headers=h,json=cross[i:i+400],timeout=90); rr.raise_for_status()

    print(json.dumps({"psr_rows":len(psr),"psr_hs6":len(hs6_rules),"rule_types":dict(rule_types),
                      "crosswalk_rows":len(cross),"mapped_cn8":mapped_cn,"unresolved_cn8":len(unresolved)},ensure_ascii=False))

if __name__=="__main__":
    main()

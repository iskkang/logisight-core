import io, os, re, hashlib, requests, pdfplumber
from bs4 import BeautifulSoup
from supabase import create_client

PAGE=os.getenv("EU_CLASS_EVIDENCE_URL","https://taxation-customs.ec.europa.eu/news/big-step-simplification-commission-publishes-consolidated-list-classification-regulations-2025-05-12_en")
SB=os.environ["SUPABASE_URL"]; KEY=os.environ["SUPABASE_SERVICE_ROLE_KEY"]
ALLOWED=("https://taxation-customs.ec.europa.eu/","https://eur-lex.europa.eu/","https://data.europa.eu/")
if not PAGE.startswith(ALLOWED): raise SystemExit("official EU source required")
r=requests.get(PAGE,timeout=60,headers={"User-Agent":"Logisight-EU-Evidence/1.1"}); r.raise_for_status()
pdf_url=PAGE
if "pdf" not in r.headers.get("content-type","").lower():
    soup=BeautifulSoup(r.text,"html.parser")
    links=[]
    for a in soup.find_all("a",href=True):
        href=requests.compat.urljoin(PAGE,a["href"])
        txt=a.get_text(" ",strip=True).lower()
        # Commission Drupal download links often have no .pdf suffix and the
        # visible anchor text can be only "Download". Prefer any official
        # document/download attachment near the consolidated-list page.
        if (".pdf" in href.lower() or "/document/download/" in href.lower()):
            links.append(href)
    if not links: raise SystemExit("official consolidated-list attachment not found")
    # Validate candidate attachments by fetching them; choose the largest PDF,
    # which is the consolidated list (currently ~8.5 MB), not small page assets.
    candidates=[]
    for href in links:
        try:
            rr=requests.get(href,timeout=120,headers={"User-Agent":"Logisight-EU-Evidence/1.2"})
            ct=rr.headers.get("content-type","").lower()
            if rr.ok and (rr.content[:4]==b"%PDF" or "pdf" in ct):
                candidates.append((len(rr.content),href,rr))
        except requests.RequestException:
            pass
    if not candidates: raise SystemExit("no PDF attachment found on official Commission page")
    _,pdf_url,r=max(candidates,key=lambda x:x[0]) r=requests.get(pdf_url,timeout=120,headers={"User-Agent":"Logisight-EU-Evidence/1.1"}); r.raise_for_status()

records=[]; seen=set()
with pdfplumber.open(io.BytesIO(r.content)) as pdf:
    for pno,page in enumerate(pdf.pages,1):
        text=page.extract_text(x_tolerance=2,y_tolerance=2) or ""
        lines=[re.sub(r"\\s+"," ",x).strip() for x in text.splitlines() if x.strip()]
        for i,line in enumerate(lines):
            # A valid row must contain a regulation reference and at least one CN code.
            reg=re.search(r"(?:Regulation|Reg\\.?|R\\.)[^0-9]{0,20}(?:\\(EU\\)\\s*)?(?:No\\s*)?(\\d{2,4}/\\d{1,4}|\\d{1,4}/\\d{2,4})",line,re.I)
            if not reg: continue
            window=" ".join(lines[i:min(i+4,len(lines))])
            codes=re.findall(r"(?<!\\d)(\\d{4}(?:\\s?\\d{2}){0,3})(?!\\d)",window)
            codes=[re.sub(r"\\s","",c) for c in codes]
            codes=[c for c in codes if len(c) in (4,6,8,10)]
            if not codes: continue
            # Prefer the last/current-transposed code in the row/window.
            code=codes[-1]
            sid=f"{reg.group(1)}:p{pno}:{code}"
            if sid in seen: continue
            seen.add(sid)
            records.append({
              "market":"EU","cn_code":code,"source_type":"CLASSIFICATION_REGULATION","source_id":sid,
              "title":f"EU Classification Regulation {reg.group(1)}","product_description":window[:1800],
              "decision_summary":"Listed as a currently valid EU Classification Regulation in the Commission consolidated list; CN code shown is the current/transposed code captured from the official list.",
              "legal_basis":f"EU Classification Regulation {reg.group(1)}","source_url":pdf_url,
              "source_version":"2026-02-11","source_hash":hashlib.sha256(window.encode()).hexdigest(),
              "is_active":True,"metadata":{"commission_consolidated_list":True,"page":pno,"source_page":PAGE}
            })
if len(records)<50: raise SystemExit(f"parser confidence guard: only {len(records)} rows; refusing mutation")
sb=create_client(SB,KEY)
for i in range(0,len(records),200):
    sb.table("customs_classification_evidence").upsert(records[i:i+200],on_conflict="source_type,source_id").execute()
print({"ingested":len(records),"pdf":pdf_url})

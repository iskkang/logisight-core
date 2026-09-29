#!/usr/bin/env python3
import os,re,subprocess,tempfile,requests
from datetime import date

PDF_URL="https://sede.agenciatributaria.gob.es/static_files/Sede/Tema/Aduanas/Comercio_exterior/Nomenclaturas/2026/OJ_L_202501926_ES_TXT.pdf"
SRC="https://eur-lex.europa.eu/eli/reg_impl/2025/1926/oj"
CODE=re.compile(r"(?<!\d)(\d{4})\s+(\d{2})\s+(\d{2})(?!\d)")
PCT=re.compile(r"^(\d+(?:[.,]\d+)?)\s*%$")
def clean_rate(s):
    s=re.sub(r"\s*\([^)]*\)\s*$","",s.strip())
    return s
def parse(text):
    out={}
    for line in text.splitlines():
        m=CODE.search(line)
        if not m: continue
        code="".join(m.groups())
        tail=line[m.end():].strip()
        cols=[x.strip() for x in re.split(r"\s{2,}",tail) if x.strip()]
        if not cols: continue
        rate=clean_rate(cols[-1])
        low=rate.lower()
        if low in {"free","exento","0 %","0%"}: pct=0.0
        else:
            p=PCT.match(rate); pct=float(p.group(1).replace(",",".")) if p else None
            if pct is None and not any(x in low for x in ["€/","eur/","euro/","min","max","+"]): continue
        out[code]=(pct,rate)
    return out
def main():
    r=requests.get(PDF_URL,timeout=180,headers={"User-Agent":"Logisight-CN-Duty/1.0"});r.raise_for_status()
    with tempfile.TemporaryDirectory() as d:
        pdf=f"{d}/cn.pdf"; txt=f"{d}/cn.txt"; open(pdf,"wb").write(r.content)
        subprocess.run(["pdftotext","-layout",pdf,txt],check=True)
        raw=open(txt,encoding="utf-8",errors="ignore").read()
        for needle in ["6109 10 00","3304 99 00","Tipo convencional","Conventional rate"]:
            pos=raw.find(needle)
            if pos>=0: print("DEBUG",needle,repr(raw[max(0,pos-500):pos+1000]))
        rows=parse(raw)
    if len(rows)<7000: raise RuntimeError(f"only {len(rows)} duty rows parsed")
    base=os.environ["SUPABASE_URL"].rstrip("/"); key=os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    h={"apikey":key,"Authorization":f"Bearer {key}","Content-Type":"application/json","Prefer":"return=minimal"}
    payload=[]
    for code,(pct,rate) in rows.items():
        payload.append({"cn_code":code,"origin_country":None,"destination_country":None,"measure_type":"THIRD_COUNTRY_DUTY","rate_percent":pct,"rate_text":rate,"title":"EU CN 2026 conventional rate of duty","detail":"Official CN 2026 conventional duty","legal_basis":"Commission Implementing Regulation (EU) 2025/1926","source_url":SRC,"valid_from":"2026-01-01","valid_to":"2026-12-31","is_active":True,"metadata":{"source":"CN 2026 official regulation","year":2026}})
    requests.delete(base+"/rest/v1/eu_customs_measures?measure_type=eq.THIRD_COUNTRY_DUTY&metadata->>source=eq.CN%202026%20official%20regulation",headers=h,timeout=60).raise_for_status()
    for i in range(0,len(payload),400):
        requests.post(base+"/rest/v1/eu_customs_measures",headers=h,json=payload[i:i+400],timeout=60).raise_for_status()
    print("ingested",len(payload))
if __name__=="__main__": main()

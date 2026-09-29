#!/usr/bin/env python3
import os,subprocess,tempfile,requests,re
URL="https://www.customs.go.kr/upload/call/FTA.pdf"
r=requests.get(URL,timeout=180,headers={"User-Agent":"Logisight-PSR-Diagnostic/1.0"}); r.raise_for_status()
with tempfile.TemporaryDirectory() as d:
    pdf=f"{d}/fta.pdf"; txt=f"{d}/fta.txt"
    open(pdf,"wb").write(r.content)
    subprocess.run(["pdftotext","-layout",pdf,txt],check=True)
    raw=open(txt,encoding="utf-8",errors="ignore").read()
for needle in ["ANNEX II","6109","CHAPTER 61","3907","9018","List of working or processing"]:
    pos=raw.find(needle)
    print("\n###",needle,"@",pos)
    if pos>=0: print(raw[max(0,pos-2500):pos+6000])
print("chars",len(raw))

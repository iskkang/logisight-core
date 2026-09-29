#!/usr/bin/env python3
import requests,re
from bs4 import BeautifulSoup
URL="https://www.customs.go.kr/ftaportalkor/ad/ftaTrtyPsr/psr.do?mi=3528"
h={"User-Agent":"Mozilla/5.0","Accept-Language":"ko-KR,ko;q=0.9,en;q=0.8"}
r=requests.get(URL,headers=h,timeout=90); print("status",r.status_code,"url",r.url,"bytes",len(r.content)); r.raise_for_status()
html=r.text
soup=BeautifulSoup(html,"html.parser")
print("FORMS")
for f in soup.find_all("form"):
    print("form",f.get("id"),f.get("name"),f.get("method"),f.get("action"))
    for x in f.find_all(["input","select","button"]):
        print(" ",x.name,x.get("name"),x.get("id"),x.get("value"))
print("SCRIPTS")
for sc in soup.find_all("script"):
    src=sc.get("src")
    if src: print("src",src)
    txt=sc.get_text("\n",strip=True)
    if any(k in txt for k in ["ftaTrtyPsr","fId","ajax","psr","search"]):
        print("INLINE",txt[:12000])
for needle in ["fId","ftaTrtyPsr","ajax","searchKeyword","hsCode","searchHs","list.do","select.do"]:
    print("\nNEEDLE",needle)
    for m in list(re.finditer(re.escape(needle),html,re.I))[:10]:
        print(html[max(0,m.start()-700):m.start()+1800].replace("\n"," ")[:2500])

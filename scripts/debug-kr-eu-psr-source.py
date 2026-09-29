#!/usr/bin/env python3
import requests,re
from bs4 import BeautifulSoup
BASE="https://www.customs.go.kr"
h={"User-Agent":"Mozilla/5.0","Accept-Language":"ko-KR,ko;q=0.9,en;q=0.8","X-Requested-With":"XMLHttpRequest"}
sess=requests.Session(); sess.headers.update(h)
sess.get(BASE+"/ftaportalkor/ad/ftaTrtyPsr/psr.do?mi=3528",timeout=60).raise_for_status()
url=BASE+"/ftaportalkor/ad/ftaTrtyPsr/psrDataInfo.do"
tests=[
 {"txrtType":"EU","ftaId":"KOREU"},
 {"searchType":"01","searchValue":"610910","txrtType":"EU","ftaId":"KOREU"},
 {"searchType":"01","searchValue":"390740","txrtType":"EU","ftaId":"KOREU"},
]
for p in tests:
    r=sess.post(url,data=p,timeout=90)
    print("\nPARAMS",p,"STATUS",r.status_code,"BYTES",len(r.content),"URL",r.url)
    r.raise_for_status()
    text=r.text
    soup=BeautifulSoup(text,"html.parser")
    print("TEXT",soup.get_text(" | ",strip=True)[:12000])
    print("FORMS")
    for f in soup.find_all("form"):
      print(f.get("id"),f.get("name"),f.get("method"),f.get("action"),[(x.get("name"),x.get("value")) for x in f.find_all("input")])
    print("LINKS",[(a.get_text(" ",strip=True),a.get("href"),a.get("onclick")) for a in soup.find_all("a")][-30:])
    for needle in ["pageIndex","currentPage","total","610910","KOREU","searchValue"]:
      m=re.search(needle,text,re.I)
      if m: print("AROUND",needle,text[max(0,m.start()-700):m.start()+1800].replace("\n"," ")[:2600])

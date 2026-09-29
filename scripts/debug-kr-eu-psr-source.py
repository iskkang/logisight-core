#!/usr/bin/env python3
import requests
from bs4 import BeautifulSoup
BASE="https://www.customs.go.kr"
h={"User-Agent":"Mozilla/5.0","Accept-Language":"ko-KR,ko;q=0.9,en;q=0.8","X-Requested-With":"XMLHttpRequest"}
sess=requests.Session(); sess.headers.update(h)
sess.get(BASE+"/ftaportalkor/ad/ftaTrtyPsr/psr.do?mi=3528",timeout=60).raise_for_status()
url=BASE+"/ftaportalkor/ad/ftaTrtyPsr/psrCategoryView.do"
for ch in ["61","39","90"]:
    p={"ftaId":"KOREU","nationId":"EU","searchType":"01","searchValue":ch}
    r=sess.post(url,data=p,timeout=90); r.raise_for_status()
    soup=BeautifulSoup(r.text,"html.parser")
    print("\nCHAPTER",ch,"BYTES",len(r.content),"TABLES",len(soup.find_all("table")),"ROWS",len(soup.find_all("tr")))
    print("TEXT",soup.get_text(" | ",strip=True)[:20000])
    for ti,t in enumerate(soup.find_all("table")):
        print("TABLE",ti,"CAPTION",t.find("caption").get_text(" ",strip=True) if t.find("caption") else "")
        for row in t.find_all("tr")[:12]:
            print("ROW",[c.get_text(" ",strip=True) for c in row.find_all(["th","td"])])

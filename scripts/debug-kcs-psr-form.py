import re,requests
from bs4 import BeautifulSoup
BASE="https://www.customs.go.kr"
S=requests.Session(); S.headers.update({"User-Agent":"Mozilla/5.0"})
for code in ["61","6109","610910"]:
    ep="/ftaportalkor/ad/ftaTrtyPsr/psrCategoryView.do" if len(code)<6 else "/ftaportalkor/ad/ftaTrtyPsr/psrDataInfo.do"
    data={"ftaId":"KOREU","nationId":"EU","searchType":"01","searchValue":code}
    if len(code)>=6:data["txrtType"]="EU"
    r=S.post(BASE+ep,data=data,timeout=60); r.raise_for_status()
    soup=BeautifulSoup(r.text,"html.parser")
    print("CODE",code,"EP",ep,"BYTES",len(r.content))
    vals=[]
    for a in soup.find_all("a",onclick=True):
        m=re.search(r"fSearch\('([^']+)'\)",a.get("onclick",""))
        if m: vals.append((m.group(1),a.get_text(" ",strip=True)))
    print("CHILDREN",vals[:50],"COUNT",len(vals))
    print("TEXT",soup.get_text(" | ",strip=True)[:4000])

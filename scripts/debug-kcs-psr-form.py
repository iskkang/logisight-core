import requests
from bs4 import BeautifulSoup
url="https://www.customs.go.kr/ftaportalkor/ad/ftaTrtyPsr/psr.do?mi=3528"
html=requests.get(url,headers={"User-Agent":"Mozilla/5.0"},timeout=60).text
s=BeautifulSoup(html,"html.parser")
for i,f in enumerate(s.find_all("form")):
    print("FORM",i,"action=",f.get("action"),"method=",f.get("method"))
    for el in f.find_all(["input","select","button"]):
        print(" ",el.name,"name=",el.get("name"),"id=",el.get("id"),"value=",el.get("value"))
print("SCRIPTS")
for x in s.find_all("script"):
    src=x.get("src")
    txt=x.get_text(" ",strip=True)
    if src: print("SRC",src)
    elif "psr" in txt.lower() or "ajax" in txt.lower() or "fta" in txt.lower():
        print(txt[:5000])

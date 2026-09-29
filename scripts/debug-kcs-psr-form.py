import os,subprocess,tempfile,requests
url="https://www.customs.go.kr/common/nttFileDownload.do?fileKey=baee47db73be787e49c4e253fc2f5c23"
r=requests.get(url,headers={"User-Agent":"Mozilla/5.0"},timeout=120); r.raise_for_status()
with tempfile.TemporaryDirectory() as d:
    pdf=os.path.join(d,"x.pdf"); txt=os.path.join(d,"x.txt")
    open(pdf,"wb").write(r.content)
    subprocess.run(["pdftotext","-layout",pdf,txt],check=True)
    lines=open(txt,encoding="utf-8",errors="replace").read().splitlines()
    print("LINES",len(lines))
    for i,line in enumerate(lines[:220],1):
        print(f"{i:04d}",line)

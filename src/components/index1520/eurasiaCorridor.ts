// 자동생성(index1520 route 세그먼트 기반) — 유라시아 철도 코리도어 정적 네트워크.
// 노드: [lat, lng, label]. 세그먼트: [fromCode, toCode].
export const CORRIDOR_NODES: Record<string, [number, number, string]> = {"130505":[52.13,23.66,"Brest"],"707701":[44.21,80.4,"Altynkol"],"708507":[45.26,82.49,"Dostyk"],"HORG":[44.21,80.42,"Khorgos"],"URUM":[43.83,87.62,"Urumqi"],"SHAN":[42.87,90.22,"Shanshan"],"HAMI":[42.83,93.51,"Hami"],"LANC":[36.06,103.83,"Lanzhou"],"CHAN":[28.23,112.94,"Changsha"],"SIAN":[34.34,108.94,"Xi'an"],"UHAN":[30.59,114.3,"Wuhan"],"CHEN":[30.57,104.07,"Chengdu"],"HEFE":[31.82,117.23,"Hefei"],"KUIT":[44.43,84.9,"Kuytun"],"ALAS":[45.17,82.57,"Alashankou"],"MNSK":[53.9,27.57,"Minsk"],"RYAZ":[54.62,39.71,"Ryazan"],"ORNB":[51.77,55.1,"Orenburg"],"MALS":[52.03,23.46,"Malaszewicze"],"DUIS":[51.43,6.76,"Duisburg"],"POZN":[52.41,16.93,"Poznan"]};

export const CORRIDOR_SEGMENTS: [string, string][] = [["HORG","707701"],["URUM","HORG"],["SHAN","URUM"],["HAMI","SHAN"],["LANC","HAMI"],["CHAN","LANC"],["MNSK","130505"],["RYAZ","MNSK"],["ORNB","RYAZ"],["707701","ORNB"],["130505","MALS"],["ALAS","708507"],["KUIT","ALAS"],["URUM","KUIT"],["708507","ORNB"],["SIAN","LANC"],["UHAN","LANC"],["130505","DUIS"],["CHEN","LANC"],["130505","POZN"],["HEFE","LANC"]];

// index1520 영문 성명 → DataV(geo.datav) 중국어명 매칭용.
export const CN_PROVINCE_EN_TO_CN: Record<string, string> = {"Shaanxi":"陕西省","Sichuan":"四川省","Zhejiang":"浙江省","Hubei":"湖北省","Chongqing":"重庆市","Fujian":"福建省","Guangdong":"广东省","Hunan":"湖南省","Jiangsu":"江苏省","Anhui":"安徽省","Shanghai":"上海市","Shandong":"山东省","Xinjiang":"新疆维吾尔自治区","Henan":"河南省"};

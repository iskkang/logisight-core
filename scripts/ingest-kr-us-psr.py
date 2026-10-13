#!/usr/bin/env python3
"""한-미 FTA 품목별 원산지기준(PSR) 적재.

필요 env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

출처는 한-EU FTA PSR 과 같은 관세청 FTA 포털이다. 그 포털은 한국의 모든 FTA 를
다루므로 ftaId/nationId 만 바꾸면 된다(KOREU/EU → KORUS/US). 실측으로 확인했다.

한-EU 와 다른 점 둘:
  1. HS 버전 크로스워크가 필요 없다. 한-EU PSR 은 HS2007 기준이라 CN2026 →
     HS2007 매핑표(eu_hs_crosswalk)를 따로 만들어야 했는데, 여기서 받는 코드는
     표본 50개가 모두 현행 미국 HTS 에 그대로 있었다.
  2. 역내부가가치(RVC)에 집적법·공제법 두 방식이 있다. 한-EU 의 MC(비원산지
     재료 최대 비율)와 계산 방향이 반대다 —— 같은 타입으로 뭉개면 안 된다.

저장은 eu_origin_rules 에 agreement='KR-US FTA' 로 한다. 표 이름은 EU 지만
스키마가 agreement 로 구분되고 조회도 agreement 로 거른다(eu-origin-assessment.ts).
새 표를 만들면 같은 구조가 둘이 된다.
"""

from __future__ import annotations

import os
import re
import sys
import time

import requests

PSR_DATA = "https://www.customs.go.kr/ftaportalkor/ad/ftaTrtyPsr/psrCategoryView.do"
AGREEMENT = "KR-US FTA"
SOURCE_NAME = "KCS FTA Portal KORUS PSR"
SOURCE_URL = "https://www.customs.go.kr/ftaportalkor/ad/ftaTrtyPsr/psr.do?mi=3528"
LEGAL_BASIS = "KORUS FTA Annex 4-A; KCS FTA Portal"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36"

ROW = re.compile(r"<tr[^>]*>(.*?)</tr>", re.S)
CELL = re.compile(r"<td[^>]*>(.*?)</td>", re.S)
TAG = re.compile(r"<[^>]+>")
# "집적법의 경우 35%, 공제법의 경우 45% 이상의 역내 부가가치"
RVC = re.compile(r"집적법[^0-9]{0,60}?(\d+(?:\.\d+)?)\s*%.{0,80}?공제법[^0-9]{0,60}?(\d+(?:\.\d+)?)\s*%", re.S)
RVC_ONE = re.compile(r"(집적법|공제법)[^0-9]{0,60}?(\d+(?:\.\d+)?)\s*%")


def clean(value: str) -> str:
    return re.sub(r"\s+", " ", TAG.sub(" ", str(value or "")).replace(" ", " ")).strip()


def parse_rule(text: str) -> tuple[str | None, dict | None]:
    """한국어 규칙 문구에서 유형을 뽑는다.

    못 알아보면 (None, None) 을 돌려주고 원문만 저장한다 —— 틀린 유형을 넣어
    자동판정이 잘못 '충족' 을 내는 것보다 '판정 보류' 가 안전하다.
    """
    t = text
    nodes: list[dict] = []

    if "완전생산" in t or "완전히 생산" in t:
        nodes.append({"type": "WO"})
    # 류(2자리) > 호(4자리) > 소호(6자리). 좁은 것부터 보면 오인한다.
    if re.search(r"다른\s*류", t):
        nodes.append({"type": "CC"})
    elif re.search(r"다른\s*호", t):
        nodes.append({"type": "CTH"})
    elif re.search(r"다른\s*소호", t):
        nodes.append({"type": "CTSH"})

    both = RVC.search(t)
    if both:
        nodes.append({"type": "RVC", "buildUpPercent": float(both.group(1)), "buildDownPercent": float(both.group(2))})
    else:
        one = RVC_ONE.search(t)
        if one:
            key = "buildUpPercent" if one.group(1) == "집적법" else "buildDownPercent"
            nodes.append({"type": "RVC", key: float(one.group(2))})

    if not nodes:
        return None, None
    if len(nodes) == 1:
        node = nodes[0]
        return node["type"], node
    # "다음 각 호의 어느 하나" = 선택 충족. 그 말이 없으면 모두 충족이다.
    # 유형 이름은 기존 평가기(eu-origin-assessment.ts 의 evalNode)에 맞춘다 ——
    # OR/AND 와 rules 배열이다. 새 이름을 쓰면 평가기를 고쳐야 하고 그러면
    # 한-EU 판정에도 손이 간다.
    combinator = "OR" if ("어느 하나" in t or "또는" in t) else "AND"
    return combinator, {"type": combinator, "rules": nodes}


def fetch_chapter(session: requests.Session, chapter: int) -> list[dict]:
    # 포털이 연속 요청을 끊는다(ConnectionReset). 간격을 두고 재시도한다.
    response = None
    for attempt in range(4):
        try:
            response = session.post(
                PSR_DATA,
                data={"ftaId": "KORUS", "nationId": "US", "searchType": "01", "searchValue": f"{chapter:02d}"},
                timeout=90,
            )
            response.raise_for_status()
            break
        except Exception:
            if attempt == 3:
                raise
            time.sleep(2 + attempt * 3)
    assert response is not None
    out = []
    for raw in ROW.findall(response.text):
        cells = [clean(c) for c in CELL.findall(raw)]
        if len(cells) < 4 or not re.fullmatch(r"\d{6}", cells[0]):
            continue
        hs6, _, name_ko, rule_ko = cells[0], cells[1], cells[2], cells[3]
        if len(rule_ko) < 4:
            continue
        rule_code, rule_json = parse_rule(rule_ko)
        out.append({
            "agreement": AGREEMENT,
            "hs_prefix": hs6,
            "hs_version": 2022,
            "rule_code": rule_code,
            "rule_text_ko": rule_ko[:4000],
            "rule_text_en": None,
            "rule_json": rule_json,
            "selector_text": name_ko[:500],
            "source_url": SOURCE_URL,
            "legal_basis": LEGAL_BASIS,
            "is_active": True,
            "metadata": {"source": SOURCE_NAME, "chapter": chapter},
        })
    return out


def replace(rows: list[dict]) -> None:
    """한-미 행만 지우고 다시 넣는다.

    eu_origin_rules 에는 (agreement, hs_prefix, hs_version) 유니크 제약이 없어
    on_conflict 를 쓸 수 없다. 제약을 새로 거는 건 기존 한-EU 5,665행에 영향이
    가므로(중복이 있으면 생성 자체가 실패한다) 건드리지 않는다.
    삭제는 agreement 로 범위를 좁혀 한-EU 데이터에 닿지 않게 한다.
    """
    base = os.environ["SUPABASE_URL"].rstrip("/")
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }
    deleted = requests.delete(
        f"{base}/rest/v1/eu_origin_rules?agreement=eq.{AGREEMENT.replace(' ', '%20')}",
        headers=headers,
        timeout=90,
    )
    if not deleted.ok:
        raise RuntimeError(f"delete failed: {deleted.status_code} {deleted.text[:300]}")
    for i in range(0, len(rows), 300):
        response = requests.post(f"{base}/rest/v1/eu_origin_rules", headers=headers, json=rows[i:i + 300], timeout=90)
        if not response.ok:
            raise RuntimeError(f"insert failed: {response.status_code} {response.text[:300]}")


def main() -> int:
    if not os.environ.get("SUPABASE_URL") or not os.environ.get("SUPABASE_SERVICE_ROLE_KEY"):
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required")
    session = requests.Session()
    session.headers.update({"User-Agent": UA})

    rows: list[dict] = []
    seen: set[str] = set()
    for chapter in range(1, 98):
        try:
            time.sleep(0.6)
            for row in fetch_chapter(session, chapter):
                if row["hs_prefix"] in seen:
                    continue
                seen.add(row["hs_prefix"])
                rows.append(row)
        except Exception as exc:  # noqa: BLE001 - 한 류가 실패해도 나머지는 받는다
            print(f"chapter {chapter:02d} failed: {exc}")

    # 한-EU 가 5,665건이다. 절반도 못 받았으면 포털 구조가 바뀐 것으로 보고 멈춘다.
    if len(rows) < 2000:
        raise RuntimeError(f"Parsed only {len(rows)} KORUS PSR rows; refusing suspicious dataset")
    parsed = sum(1 for r in rows if r["rule_json"])
    print(f"Parsed {len(rows)} KORUS PSR rows ({parsed} with a structured rule, {len(rows) - parsed} text-only)")
    replace(rows)
    print("Ingested KORUS PSR")
    return 0


if __name__ == "__main__":
    sys.exit(main())

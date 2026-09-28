#!/usr/bin/env python3
"""Download, validate and ingest the 2026 EU Combined Nomenclature.

The source workbook is published by Malta's National Statistics Office for
Intrastat/CN 2026 and reflects the EU Combined Nomenclature. The legal source
of truth remains Commission Implementing Regulation (EU) 2025/1926.

Required env:
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY

Optional env:
  EU_CN_2026_XLSX_URL
"""

from __future__ import annotations

import os
import re
import sys
import tempfile
from datetime import date
from typing import Iterable

import requests
from openpyxl import load_workbook

SOURCE_URL = os.getenv(
    "EU_CN_2026_XLSX_URL",
    "https://nso.gov.mt/wp-content/uploads/CN_Validity_2026-483e17c9fb3ffdee.xlsx",
)
LEGAL_SOURCE_URL = (
    "https://eur-lex.europa.eu/eli/reg_impl/2025/1926/oj"
)
SOURCE_VERSION = "CN 2026 / Commission Implementing Regulation (EU) 2025/1926"
CODE_RE = re.compile(r"^\d{8}$")


def normalize_code(value: object) -> str:
    if value is None:
        return ""
    if isinstance(value, (int, float)):
        value = str(int(value))
    return re.sub(r"\D", "", str(value)).zfill(8)


def find_columns(rows: list[tuple[object, ...]]) -> tuple[int, int, int]:
    """Return (header row, code col, description col), failing closed."""
    code_names = {"cn code", "cn_code", "code", "commodity code", "cn8"}
    desc_names = {"description", "goods description", "cn description", "text"}

    for row_idx, row in enumerate(rows[:30]):
        normalized = [str(v or "").strip().lower() for v in row]
        code_col = next((i for i, v in enumerate(normalized) if v in code_names), None)
        desc_col = next((i for i, v in enumerate(normalized) if v in desc_names), None)
        if code_col is not None and desc_col is not None:
            return row_idx, code_col, desc_col

    # Some official workbooks have no conventional English header. Infer only
    # if a column clearly contains CN8 values and another contains descriptions.
    sample = rows[:200]
    for code_col in range(max((len(r) for r in sample), default=0)):
        hits = sum(
            1
            for r in sample
            if code_col < len(r) and CODE_RE.fullmatch(normalize_code(r[code_col]))
        )
        if hits < 20:
            continue
        for desc_col in range(max((len(r) for r in sample), default=0)):
            if desc_col == code_col:
                continue
            text_hits = sum(
                1
                for r in sample
                if desc_col < len(r) and len(str(r[desc_col] or "").strip()) >= 5
            )
            if text_hits >= hits // 2:
                return 0, code_col, desc_col

    raise RuntimeError("Could not identify CN code/description columns; refusing to ingest")


def parse_workbook(path: str) -> list[dict[str, object]]:
    wb = load_workbook(path, read_only=True, data_only=True)
    candidates: list[dict[str, object]] = []

    for ws in wb.worksheets:
        rows = list(ws.iter_rows(values_only=True))
        if not rows:
            continue
        try:
            header_row, code_col, desc_col = find_columns(rows)
        except RuntimeError:
            continue

        for row in rows[header_row + 1 :]:
            if max(code_col, desc_col) >= len(row):
                continue
            code = normalize_code(row[code_col])
            description = str(row[desc_col] or "").strip()
            if not CODE_RE.fullmatch(code) or len(description) < 2:
                continue
            candidates.append(
                {
                    "market": "EU",
                    "nomenclature": "CN",
                    "code": code,
                    "parent_code": code[:6],
                    "description": description,
                    "level": 8,
                    "valid_from": date(2026, 1, 1).isoformat(),
                    "valid_to": date(2026, 12, 31).isoformat(),
                    "source_name": "EU Combined Nomenclature 2026",
                    "source_url": LEGAL_SOURCE_URL,
                    "source_version": SOURCE_VERSION,
                    "is_active": True,
                }
            )

    # CN normally contains many thousands of codes. A low count almost always
    # means the upstream workbook layout changed or parsing selected bad columns.
    deduped = {row["code"]: row for row in candidates}
    rows = list(deduped.values())
    if len(rows) < 5_000:
        raise RuntimeError(
            f"Parsed only {len(rows)} unique CN8 rows; refusing to ingest suspicious dataset"
        )
    if any(not CODE_RE.fullmatch(str(row["code"])) for row in rows):
        raise RuntimeError("Invalid CN8 code detected")
    return rows


def chunks(items: list[dict[str, object]], size: int = 500) -> Iterable[list[dict[str, object]]]:
    for i in range(0, len(items), size):
        yield items[i : i + size]


def upsert(rows: list[dict[str, object]]) -> None:
    base = os.environ["SUPABASE_URL"].rstrip("/")
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    url = f"{base}/rest/v1/customs_nomenclature?on_conflict=market,nomenclature,code,valid_from"
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=minimal",
    }
    for batch in chunks(rows):
        response = requests.post(url, headers=headers, json=batch, timeout=60)
        response.raise_for_status()


def main() -> int:
    with tempfile.NamedTemporaryFile(suffix=".xlsx") as tmp:
        response = requests.get(SOURCE_URL, timeout=60)
        response.raise_for_status()
        if len(response.content) < 10_000:
            raise RuntimeError("Downloaded CN workbook is unexpectedly small")
        tmp.write(response.content)
        tmp.flush()
        rows = parse_workbook(tmp.name)

    upsert(rows)
    print(f"Ingested {len(rows)} validated CN8 rows for 2026")
    return 0


if __name__ == "__main__":
    sys.exit(main())

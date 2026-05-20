"""
Tiny CLI: dumps the first page of each FDIC endpoint into ./sample/*.json so
you can eyeball the response shape before configuring the SDK runner.

    python run_local.py
    python run_local.py --year 2024
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import requests

from connector import (
    FDIC_BASE,
    PAGE_LIMIT,
    INSTITUTION_FIELDS,
    FAILURE_FIELDS,
    SOD_FIELDS,
)

OUT_DIR = Path(__file__).resolve().parent / "sample"


def fetch(name: str, url: str) -> int:
    print(f"→ {name}: {url}")
    resp = requests.get(url, timeout=30)
    resp.raise_for_status()
    payload = resp.json()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out = OUT_DIR / f"{name}.json"
    out.write_text(json.dumps(payload, indent=2))
    rows = len(payload.get("data") or [])
    print(f"   wrote {out.relative_to(Path.cwd()) if out.is_absolute() else out} ({rows} rows)")
    return rows


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--year", type=int, default=2024,
                    help="Year for the Summary of Deposits sample (default 2024)")
    args = ap.parse_args()

    fetch(
        "institutions",
        f"{FDIC_BASE}/institutions?filters=ACTIVE:1"
        f"&limit={PAGE_LIMIT}&offset=0&fields={INSTITUTION_FIELDS}",
    )
    fetch(
        "failures",
        f"{FDIC_BASE}/failures?limit={PAGE_LIMIT}&offset=0&fields={FAILURE_FIELDS}",
    )
    fetch(
        f"summary_of_deposits_{args.year}",
        f"{FDIC_BASE}/sod?limit={PAGE_LIMIT}&offset=0"
        f"&filters=YEAR:{args.year}&fields={SOD_FIELDS}",
    )
    print(f"\nSamples written to: {OUT_DIR}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

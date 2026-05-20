"""
Build a static JSON snapshot of the Sentinel ODI gold layer for the frontend.

Pipeline (when live):
    Dropbox / FDIC  →  Snowflake bronze  →  dbt (silver, gold)
                                                  │
                                                  ▼
                                       frontend/public/data/*.json

Run locally:
    # Live mode — pulls from Snowflake gold
    SNOWFLAKE_ACCOUNT=… SNOWFLAKE_USER=… SNOWFLAKE_PASSWORD=… \\
    SNOWFLAKE_WAREHOUSE=ODI_WH SNOWFLAKE_DATABASE=ODI_DROPBOX \\
    SNOWFLAKE_ROLE=DBT_BUILDER \\
        python scripts/build_snapshot.py

    # Synthetic fallback — no credentials required
    python scripts/build_snapshot.py

Outputs (all under sentinel-app/frontend/public/data/):
    summary.json
    institutions.json
    institutions/<cert_id>.json     (~15 detail bundles)
    failures.json
    state_risk.json
    pipeline.json
    catalog.json
"""
from __future__ import annotations

import datetime as dt
import json
import os
import shutil
import sys
from pathlib import Path
from typing import Any

# Local module — synthetic generator stays isolated.
sys.path.insert(0, str(Path(__file__).resolve().parent))
from _synthetic import generate as synth_generate  # type: ignore  # noqa: E402

ROOT       = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "frontend" / "public" / "data"
INST_DIR   = OUTPUT_DIR / "institutions"

# ── Snowflake config (only used when present) ──────────────────────────────
SF_ACCOUNT   = os.getenv("SNOWFLAKE_ACCOUNT")
SF_USER      = os.getenv("SNOWFLAKE_USER")
SF_PASSWORD  = os.getenv("SNOWFLAKE_PASSWORD")
SF_WAREHOUSE = os.getenv("SNOWFLAKE_WAREHOUSE", "ODI_WH")
SF_DATABASE  = os.getenv("SNOWFLAKE_DATABASE", "ODI_DROPBOX")
SF_ROLE      = os.getenv("SNOWFLAKE_ROLE", "DBT_BUILDER")
SF_SCHEMA    = os.getenv("SNOWFLAKE_SCHEMA", "GOLD")


# ---------------------------------------------------------------------------
# Live (Snowflake) path
# ---------------------------------------------------------------------------

def have_snowflake() -> bool:
    return bool(SF_ACCOUNT and SF_USER and SF_PASSWORD)


def from_snowflake() -> dict[str, Any]:  # pragma: no cover — needs live SF
    """Pull the gold-layer marts from Snowflake.

    Wired here as the production code path. The synthetic fallback is used
    by default so the demo is self-contained.
    """
    import snowflake.connector  # type: ignore  # noqa: PLC0415

    _ = snowflake.connector.connect(
        account=SF_ACCOUNT, user=SF_USER, password=SF_PASSWORD,
        warehouse=SF_WAREHOUSE, database=SF_DATABASE, role=SF_ROLE,
        schema=SF_SCHEMA,
    )
    # The real implementation would:
    #   1. SELECT * from each gold mart (dim_institution, fct_failures,
    #      mart_state_risk, mart_file_lineage, …) into list[dict].
    #   2. Compose the same bundle shape that synth_generate() returns.
    raise NotImplementedError(
        "Snowflake live path is wired but disabled in this demo — "
        "populate the gold marts then enable here."
    )


# ---------------------------------------------------------------------------
# Snapshot writer
# ---------------------------------------------------------------------------

def _write(path: Path, payload: Any, *, compact: bool = False) -> None:
    if compact:
        path.write_text(json.dumps(payload, separators=(",", ":")))
    else:
        path.write_text(json.dumps(payload, indent=2))


def write_snapshot(bundle: dict[str, Any], source: str) -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Wipe per-entity sub-dir so stale detail files don't leak in.
    if INST_DIR.exists():
        shutil.rmtree(INST_DIR)
    INST_DIR.mkdir(parents=True, exist_ok=True)

    generated_at = dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")

    # ── summary.json ──────────────────────────────────────────────────────
    summary = {**bundle["summary"], "generated_at": generated_at, "source": source}
    _write(OUTPUT_DIR / "summary.json", summary)
    print(f"  summary.json       {len(summary)} fields")

    # ── institutions.json (full list, ~150 rows) ──────────────────────────
    institutions = bundle["institutions"]
    _write(OUTPUT_DIR / "institutions.json", institutions, compact=True)
    print(f"  institutions.json  {len(institutions)} rows")

    # ── institutions/<cert_id>.json (detail bundles, ~15) ─────────────────
    details = bundle["institution_details"]
    for cert, detail in details.items():
        _write(INST_DIR / f"{cert}.json", detail)
    print(f"  institutions/      {len(details)} detail bundles")

    # ── failures.json ─────────────────────────────────────────────────────
    failures = bundle["failures"]
    _write(OUTPUT_DIR / "failures.json", failures, compact=True)
    print(f"  failures.json      {len(failures)} rows")

    # ── state_risk.json ───────────────────────────────────────────────────
    state_risk = bundle["state_risk"]
    _write(OUTPUT_DIR / "state_risk.json", state_risk)
    print(f"  state_risk.json    {len(state_risk)} states")

    # ── pipeline.json ─────────────────────────────────────────────────────
    pipeline = {**bundle["pipeline"], "generated_at": generated_at, "source": source}
    _write(OUTPUT_DIR / "pipeline.json", pipeline)
    print(f"  pipeline.json      {len(pipeline['layers'])} layers")

    # ── catalog.json ──────────────────────────────────────────────────────
    catalog = bundle["catalog"]
    _write(OUTPUT_DIR / "catalog.json", catalog, compact=True)
    print(f"  catalog.json       {len(catalog)} files")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> int:
    print("=" * 60)
    print(" Sentinel — ODI snapshot builder")
    print("=" * 60)

    use_live = have_snowflake()
    if use_live:
        try:
            print(f"-> Pulling live snapshot from Snowflake "
                  f"({SF_DATABASE}.{SF_SCHEMA})…")
            bundle = from_snowflake()
            write_snapshot(bundle, source="snowflake")
            print(f" Done. Output: {OUTPUT_DIR}")
            return 0
        except NotImplementedError as e:
            print(f"   Live path not enabled: {e}", file=sys.stderr)
            print("-> Falling back to synthetic dataset…", file=sys.stderr)
        except Exception as e:  # noqa: BLE001
            print(f"   Snowflake query failed: {e}", file=sys.stderr)
            print("-> Falling back to synthetic dataset…", file=sys.stderr)

    print("-> Generating synthetic Sentinel dataset (seeded, deterministic)…")
    bundle = synth_generate()
    s = bundle["summary"]
    print(f"   generated: {s['total_institutions']} institutions, "
          f"{len(bundle['failures'])} failures, "
          f"{len(bundle['state_risk'])} states, "
          f"{s['file_inventory']['total_files']} files cataloged")
    print("-> Writing JSON to frontend/public/data/")
    write_snapshot(bundle, source="synthetic")
    print("=" * 60)
    print(f" Done. Output: {OUTPUT_DIR}")
    print("=" * 60)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

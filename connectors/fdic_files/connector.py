"""
FDIC Files — Fivetran Connector SDK
====================================
Pulls FDIC public CSVs from a local directory (default: ../../seed_data) and
lands them in Fivetran MDLS (Iceberg on S3 + AWS Glue Data Catalog) as the
bronze layer for the Sentinel ODI demo.

Why local-files-as-source? The real Dropbox source for this demo is locked
down by team policy. Treating a folder on disk as a Fivetran source lets the
demo show the *same* MDLS landing pattern your other MDLS demos use —
just with a different upstream connector. When the Dropbox restriction lifts,
swap `connectors/dropbox/` back in front of MDLS; the bronze schema below
is identical, so silver and gold need no changes.

ODI angle: MDLS lands these as Iceberg tables in S3 (registered in Glue), and
**dbt labs** conforms them on both the bronze→silver and silver→gold edges.
Athena / DuckDB / Trino / Spark / Snowflake-external-table can all read the
gold layer without copying data.

Tables produced (matches transform/models/bronze/_sources.yml exactly):
    fdic_failed_bank_list      PK: cert
    fdic_institutions          PK: cert
    fdic_summary_of_deposits   PK: (year, cert, uninumbr)
    _files                     PK: path

Configuration:
    {
        "source_directory": "/abs/path/to/seed_data",
        "include_quarterly_reports": "true",     // also land All_Reports_*.csv
        "max_rows_per_file": "250000"
    }
"""
from __future__ import annotations

import csv
import hashlib
import os
import re
from datetime import datetime, timezone
from typing import Iterator

from fivetran_connector_sdk import Connector, Operations as op, Logging as log


DEFAULT_MAX_ROWS = 250_000

# Filename → (table_name, primary_key_columns, column_renames)
# Matches the bronze sources declared in transform/models/bronze/_sources.yml.
KNOWN_FILES: dict[str, tuple[str, list[str], dict[str, str]]] = {
    "fdic failed bank list.csv": (
        "fdic_failed_bank_list",
        ["cert"],
        {
            "bank name": "bank_name",
            "st": "state",
            "acquiring institution": "acquiring_institution",
            "closing date": "closing_date",
            "updated date": "updated_date",
        },
    ),
    "fdic summary of deposits.csv": (
        "fdic_summary_of_deposits",
        ["year", "cert", "uninumbr"],
        {},  # FDIC SOD column names already snake-case-friendly after lowercase
    ),
    "institutions2.csv": (
        "fdic_institutions",
        ["cert"],
        {"stalp": "stalp", "namehcr": "namehcr"},
    ),
}


def _safe_column(name: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9]+", "_", str(name)).strip("_").lower()
    if not cleaned:
        return "col"
    if cleaned[0].isdigit():
        cleaned = f"c_{cleaned}"
    return cleaned[:120]


def _safe_table_name(filename: str) -> str:
    stem = os.path.splitext(filename)[0].lower()
    cleaned = re.sub(r"[^a-z0-9]+", "_", stem).strip("_")
    if not cleaned:
        cleaned = "file"
    if cleaned[0].isdigit():
        cleaned = f"t_{cleaned}"
    return cleaned[:120]


def _file_signature(path: str) -> str:
    st = os.stat(path)
    return f"{st.st_size}:{int(st.st_mtime)}"


def _classify(filename: str, include_quarterly: bool) -> tuple[str, list[str], dict[str, str]] | None:
    """Return (table, pk, renames) for a known file, or None to skip."""
    lower = filename.lower()
    if lower in KNOWN_FILES:
        return KNOWN_FILES[lower]
    if include_quarterly and lower.startswith("all_reports_") and lower.endswith(".csv"):
        # All_Reports_20150331_Performance and Condition Ratios.csv
        # → all_reports_20150331_performance_and_condition_ratios
        return (_safe_table_name(filename), ["cert", "repdte"], {})
    if include_quarterly and lower in ("offices2_all.csv",):
        return ("fdic_offices", ["uninum"], {})
    return None


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _coerce(value: str) -> object:
    """Light coercion: empty → None, numeric strings → int/float, else string."""
    if value is None:
        return None
    s = value.strip()
    if s == "" or s.upper() in ("NULL", "NA", "N/A"):
        return None
    # strip thousand separators in numeric-looking strings before testing
    bare = s.replace(",", "")
    if bare.lstrip("-").isdigit():
        try:
            return int(bare)
        except ValueError:
            pass
    try:
        return float(bare)
    except ValueError:
        return s


def schema(configuration: dict) -> list[dict]:
    return [
        {"table": "fdic_failed_bank_list", "primary_key": ["cert"]},
        {"table": "fdic_institutions", "primary_key": ["cert"]},
        {"table": "fdic_summary_of_deposits", "primary_key": ["year", "cert", "uninumbr"]},
        {
            "table": "_files",
            "primary_key": ["path"],
            "columns": {
                "path": "STRING",
                "name": "STRING",
                "extension": "STRING",
                "size_bytes": "LONG",
                "rev": "STRING",
                "client_modified": "UTC_DATETIME",
                "server_modified": "UTC_DATETIME",
                "row_count": "LONG",
                "column_count": "LONG",
                "sheet_count": "INT",
                "table_name": "STRING",
                "synced_at": "UTC_DATETIME",
                "status": "STRING",
                "error": "STRING",
            },
        },
    ]


def _iter_csv(path: str, renames: dict[str, str], max_rows: int) -> Iterator[dict]:
    with open(path, "r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        col_map: dict[str, str] = {}
        for raw in (reader.fieldnames or []):
            lowered = raw.strip().lower()
            target = renames.get(lowered, _safe_column(raw))
            col_map[raw] = target
        for i, row in enumerate(reader):
            if i >= max_rows:
                log.warning(f"row cap {max_rows} reached for {path}")
                break
            yield {col_map[k]: _coerce(v) for k, v in row.items() if k in col_map}


def update(configuration: dict, state: dict):
    state = state or {}
    seen: dict[str, str] = state.get("seen_signatures", {}) or {}

    src_dir = configuration.get("source_directory") or os.path.abspath(
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "seed_data")
    )
    src_dir = os.path.abspath(src_dir)
    if not os.path.isdir(src_dir):
        raise RuntimeError(f"source_directory does not exist: {src_dir}")

    include_quarterly = (configuration.get("include_quarterly_reports") or "false").lower() == "true"
    max_rows = int(configuration.get("max_rows_per_file") or DEFAULT_MAX_ROWS)

    log.info(f"FDIC Files scan: dir={src_dir} quarterly={include_quarterly} max_rows={max_rows}")

    files_processed = 0
    files_skipped = 0
    for name in sorted(os.listdir(src_dir)):
        full = os.path.join(src_dir, name)
        if not os.path.isfile(full):
            continue
        if not name.lower().endswith(".csv"):
            continue

        classification = _classify(name, include_quarterly)
        if classification is None:
            files_skipped += 1
            continue
        table_name, _, renames = classification

        sig = _file_signature(full)
        if seen.get(full) == sig:
            log.info(f"unchanged, skipping: {name}")
            continue

        log.info(f"loading: {name} → {table_name}")
        row_count = 0
        col_count = 0
        status = "ok"
        err = ""
        try:
            for row in _iter_csv(full, renames, max_rows):
                row["_source_file"] = name
                row["_source_signature"] = sig
                if col_count == 0:
                    col_count = len(row.keys()) - 2  # excluding the two _source_* cols
                yield op.upsert(table_name, row)
                row_count += 1
        except Exception as exc:  # noqa: BLE001 — emit per-file metadata even on failure
            status = "error"
            err = str(exc)[:500]
            log.warning(f"failed loading {name}: {err}")

        size = os.path.getsize(full)
        mtime = datetime.fromtimestamp(os.path.getmtime(full), tz=timezone.utc).isoformat()
        rev = hashlib.sha256(sig.encode("utf-8")).hexdigest()[:16]

        yield op.upsert("_files", {
            "path": full,
            "name": name,
            "extension": "csv",
            "size_bytes": size,
            "rev": rev,
            "client_modified": mtime,
            "server_modified": mtime,
            "row_count": row_count,
            "column_count": col_count,
            "sheet_count": 0,
            "table_name": table_name,
            "synced_at": _now_iso(),
            "status": status,
            "error": err,
        })

        seen[full] = sig
        state["seen_signatures"] = seen
        yield op.checkpoint(state)
        files_processed += 1

    log.info(f"FDIC Files sync complete — processed={files_processed} skipped={files_skipped}")


connector = Connector(update=update, schema=schema)


if __name__ == "__main__":
    connector.debug()

"""
Dropbox — Fivetran Connector SDK
================================
Pulls all files from a Dropbox folder (or shared-link folder) and lands them
as one bronze table per file in the destination. Tabular files (csv, tsv,
xlsx, json/ndjson, parquet) are parsed and their rows are upserted. Every
file — tabular or not — also gets a row in the `_files` metadata table.

ODI angle: the Dropbox shared folder is treated as a first-class governed
source. Once in Snowflake, dbt labs conforms the data on both the
bronze→silver and silver→gold edges. AI agents read gold directly.

Two auth modes (set in configuration.json):

1. API token mode — production-shaped:
   {
     "auth_mode": "token",
     "dropbox_access_token": "sl.B…",
     "folder_path": "/path/inside/dropbox"
   }

2. Shared-link mode — demo-friendly, no app registration:
   {
     "auth_mode": "shared_link",
     "shared_link_url": "https://www.dropbox.com/scl/fo/…",
     "shared_link_password": ""   // optional
   }

Optional:
   "max_rows_per_file": "100000"   // safety cap, default 250000
   "include_extensions": "csv,xlsx,json,parquet"   // default = all supported
"""
from __future__ import annotations

import io
import json
import os
import re
from datetime import datetime, timezone
from typing import Any, Iterable, Iterator

import requests
from fivetran_connector_sdk import Connector, Operations as op, Logging as log


DROPBOX_API = "https://api.dropboxapi.com/2"
DROPBOX_CONTENT = "https://content.dropboxapi.com/2"
HTTP_TIMEOUT = 60
DEFAULT_MAX_ROWS = 250_000
TABULAR_EXTS = {"csv", "tsv", "xlsx", "xls", "json", "ndjson", "jsonl", "parquet"}


# ---------- helpers ---------------------------------------------------------

def _safe_table_name(name: str) -> str:
    """Snowflake-friendly identifier: lowercase, alnum + underscore, no leading digit."""
    stem = os.path.splitext(name)[0].lower()
    cleaned = re.sub(r"[^a-z0-9]+", "_", stem).strip("_")
    if not cleaned:
        cleaned = "file"
    if cleaned[0].isdigit():
        cleaned = f"t_{cleaned}"
    return cleaned[:120]


def _safe_column(name: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9]+", "_", str(name)).strip("_").lower()
    if not cleaned:
        cleaned = "col"
    if cleaned[0].isdigit():
        cleaned = f"c_{cleaned}"
    return cleaned[:120]


def _ext(name: str) -> str:
    return os.path.splitext(name)[1].lower().lstrip(".")


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _post(url: str, token: str, body: dict) -> requests.Response:
    return requests.post(
        url,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        json=body,
        timeout=HTTP_TIMEOUT,
    )


# ---------- listing ---------------------------------------------------------

def list_token_mode(token: str, folder_path: str) -> Iterator[dict]:
    """Recursive list_folder. Yields file entries (dicts)."""
    body = {"path": folder_path, "recursive": True, "include_non_downloadable_files": False}
    resp = _post(f"{DROPBOX_API}/files/list_folder", token, body)
    if resp.status_code != 200:
        raise RuntimeError(f"list_folder failed: {resp.status_code} {resp.text[:300]}")
    payload = resp.json()
    for entry in payload.get("entries", []):
        if entry.get(".tag") == "file":
            yield entry
    cursor = payload.get("cursor")
    while payload.get("has_more"):
        resp = _post(f"{DROPBOX_API}/files/list_folder/continue", token, {"cursor": cursor})
        if resp.status_code != 200:
            raise RuntimeError(f"list_folder/continue failed: {resp.status_code} {resp.text[:300]}")
        payload = resp.json()
        for entry in payload.get("entries", []):
            if entry.get(".tag") == "file":
                yield entry
        cursor = payload.get("cursor")


def list_shared_link_mode(token: str, url: str, password: str | None) -> Iterator[dict]:
    """List files behind a shared link. Requires SOME bearer token (an app token,
    even with no special scopes, works because /sharing/list_shared_link_files is
    callable from any app). For purely public demos without any token,
    inspect_dropbox.py uses the unauthenticated /scl/fo URL scrape instead."""
    body: dict[str, Any] = {"shared_link": {"url": url}}
    if password:
        body["shared_link"]["password"] = password

    resp = _post(f"{DROPBOX_API}/sharing/get_shared_link_metadata", token, body)
    if resp.status_code != 200:
        raise RuntimeError(f"get_shared_link_metadata failed: {resp.status_code} {resp.text[:300]}")

    cursor: str | None = None
    while True:
        page_body = dict(body)
        if cursor:
            page_body = {"cursor": cursor}
        resp = _post(
            f"{DROPBOX_API}/files/list_folder" if cursor is None
            else f"{DROPBOX_API}/files/list_folder/continue",
            token,
            {"path": "", "recursive": True, "shared_link": body["shared_link"]}
            if cursor is None else {"cursor": cursor},
        )
        if resp.status_code != 200:
            raise RuntimeError(f"shared list_folder failed: {resp.status_code} {resp.text[:300]}")
        payload = resp.json()
        for entry in payload.get("entries", []):
            if entry.get(".tag") == "file":
                yield entry
        if not payload.get("has_more"):
            break
        cursor = payload.get("cursor")


# ---------- download --------------------------------------------------------

def download_token_mode(token: str, path: str) -> bytes:
    resp = requests.post(
        f"{DROPBOX_CONTENT}/files/download",
        headers={
            "Authorization": f"Bearer {token}",
            "Dropbox-API-Arg": json.dumps({"path": path}),
        },
        timeout=HTTP_TIMEOUT,
    )
    if resp.status_code != 200:
        raise RuntimeError(f"download failed for {path}: {resp.status_code} {resp.text[:200]}")
    return resp.content


def download_shared_link_mode(token: str, link_url: str, rel_path: str, password: str | None) -> bytes:
    arg: dict[str, Any] = {"url": link_url, "path": rel_path}
    if password:
        arg["link_password"] = password
    resp = requests.post(
        f"{DROPBOX_CONTENT}/sharing/get_shared_link_file",
        headers={
            "Authorization": f"Bearer {token}",
            "Dropbox-API-Arg": json.dumps(arg),
        },
        timeout=HTTP_TIMEOUT,
    )
    if resp.status_code != 200:
        raise RuntimeError(
            f"get_shared_link_file failed for {rel_path}: {resp.status_code} {resp.text[:200]}"
        )
    return resp.content


# ---------- parsing ---------------------------------------------------------

def parse_tabular(blob: bytes, filename: str, max_rows: int) -> list[tuple[str, list[dict]]]:
    """Return [(sub_table_suffix, rows), ...]. For xlsx multiple sheets are
    returned as separate sub-tables; otherwise a single ("", rows) is returned."""
    ext = _ext(filename)

    if ext in ("csv", "tsv"):
        import pandas as pd  # local import — only required when actually parsing
        sep = "," if ext == "csv" else "\t"
        df = pd.read_csv(io.BytesIO(blob), sep=sep, nrows=max_rows, low_memory=False)
        return [("", _df_to_rows(df))]

    if ext in ("xlsx", "xls"):
        import pandas as pd
        sheets = pd.read_excel(io.BytesIO(blob), sheet_name=None, nrows=max_rows)
        return [(_safe_table_name(name), _df_to_rows(df)) for name, df in sheets.items()]

    if ext == "parquet":
        import pandas as pd
        df = pd.read_parquet(io.BytesIO(blob))
        if len(df) > max_rows:
            df = df.head(max_rows)
        return [("", _df_to_rows(df))]

    if ext in ("json", "ndjson", "jsonl"):
        rows = _parse_json_bytes(blob, ext, max_rows)
        return [("", rows)]

    return []


def _df_to_rows(df) -> list[dict]:
    df = df.rename(columns={c: _safe_column(c) for c in df.columns})
    rows: list[dict] = []
    for record in df.to_dict(orient="records"):
        clean: dict[str, Any] = {}
        for k, v in record.items():
            # pandas NaN -> None
            try:
                import math
                if isinstance(v, float) and math.isnan(v):
                    v = None
            except Exception:
                pass
            clean[k] = v
        rows.append(clean)
    return rows


def _parse_json_bytes(blob: bytes, ext: str, max_rows: int) -> list[dict]:
    text = blob.decode("utf-8", errors="replace")
    rows: list[dict] = []
    if ext in ("ndjson", "jsonl"):
        for line in text.splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
            except json.JSONDecodeError:
                continue
            if isinstance(obj, dict):
                rows.append({_safe_column(k): v for k, v in obj.items()})
            if len(rows) >= max_rows:
                break
        return rows

    try:
        obj = json.loads(text)
    except json.JSONDecodeError:
        return []
    if isinstance(obj, list):
        for item in obj[:max_rows]:
            if isinstance(item, dict):
                rows.append({_safe_column(k): v for k, v in item.items()})
            else:
                rows.append({"value": item})
        return rows
    if isinstance(obj, dict):
        return [{_safe_column(k): v for k, v in obj.items()}]
    return []


# ---------- Fivetran connector entrypoints ---------------------------------

def schema(configuration: dict) -> list[dict]:
    # Only the metadata table is statically declared. Per-file tables are
    # created dynamically on first upsert (Fivetran infers schema).
    return [
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
        }
    ]


def update(configuration: dict, state: dict):
    state = state or {}
    seen_revs: dict[str, str] = state.get("seen_revs", {}) or {}

    auth_mode = (configuration.get("auth_mode") or "token").lower()
    token = configuration.get("dropbox_access_token") or ""
    max_rows = int(configuration.get("max_rows_per_file") or DEFAULT_MAX_ROWS)

    include_exts_cfg = configuration.get("include_extensions") or ""
    include_exts = {
        e.strip().lower().lstrip(".") for e in include_exts_cfg.split(",") if e.strip()
    } or set(TABULAR_EXTS) | {"pdf"}

    if auth_mode == "shared_link":
        link_url = configuration.get("shared_link_url") or ""
        password = configuration.get("shared_link_password") or None
        if not link_url:
            raise RuntimeError("shared_link_url is required when auth_mode=shared_link")
        if not token:
            raise RuntimeError(
                "An app bearer token is still required for the Dropbox sharing API. "
                "Create a scoped app token (sharing.read + files.content.read) and put it in "
                "dropbox_access_token. The link itself does not need to belong to that app."
            )
        listing = list_shared_link_mode(token, link_url, password)
    else:
        folder_path = configuration.get("folder_path") or ""
        if not token:
            raise RuntimeError("dropbox_access_token is required when auth_mode=token")
        listing = list_token_mode(token, folder_path)

    file_count = 0
    skipped = 0
    for entry in listing:
        file_count += 1
        path = entry.get("path_display") or entry.get("path_lower") or entry.get("name", "")
        name = entry.get("name", "")
        rev = entry.get("rev", "")
        size = int(entry.get("size", 0) or 0)
        ext = _ext(name)

        if ext not in include_exts:
            skipped += 1
            continue

        # incremental skip: same rev as last sync
        if seen_revs.get(path) == rev and rev:
            log.info(f"skip unchanged: {path} (rev={rev})")
            continue

        log.info(f"processing: {path} (ext={ext}, size={size})")
        table_name = _safe_table_name(name)
        row_total = 0
        col_total = 0
        sheet_count = 0
        status = "ok"
        err = ""

        try:
            if ext in TABULAR_EXTS:
                if auth_mode == "shared_link":
                    rel = path
                    if entry.get("path_display") and not entry["path_display"].startswith("/"):
                        rel = "/" + entry["path_display"]
                    blob = download_shared_link_mode(token, link_url, rel, password)
                else:
                    blob = download_token_mode(token, path)

                parts = parse_tabular(blob, name, max_rows)
                sheet_count = len(parts) if ext in ("xlsx", "xls") else 0

                for suffix, rows in parts:
                    out_table = table_name if not suffix else f"{table_name}__{suffix}"
                    if not rows:
                        continue
                    col_total = max(col_total, len(rows[0].keys()))
                    for r in rows:
                        r["_source_file"] = path
                        r["_source_rev"] = rev
                        yield op.upsert(out_table, r)
                        row_total += 1
            else:
                # non-tabular: metadata only
                status = "metadata_only"
        except Exception as exc:  # noqa: BLE001 — surface any error per-file, keep syncing
            status = "error"
            err = str(exc)[:500]
            log.warning(f"failed: {path}: {err}")

        yield op.upsert("_files", {
            "path": path,
            "name": name,
            "extension": ext,
            "size_bytes": size,
            "rev": rev,
            "client_modified": entry.get("client_modified") or "",
            "server_modified": entry.get("server_modified") or "",
            "row_count": row_total,
            "column_count": col_total,
            "sheet_count": sheet_count,
            "table_name": table_name,
            "synced_at": _now_iso(),
            "status": status,
            "error": err,
        })

        seen_revs[path] = rev
        state["seen_revs"] = seen_revs
        yield op.checkpoint(state)

    log.info(f"Dropbox sync complete — files_seen={file_count} skipped={skipped}")


connector = Connector(update=update, schema=schema)


if __name__ == "__main__":
    connector.debug()

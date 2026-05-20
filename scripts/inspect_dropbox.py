#!/usr/bin/env python
"""
inspect_dropbox.py — preview a Dropbox shared-link folder.

Two modes:

1) Token mode (preferred) — pass DROPBOX_ACCESS_TOKEN in the environment and
   the script will list every file via /sharing/list_shared_link_files plus
   download a small sample row from each tabular file.

2) No-token mode — scrapes the public /scl/fo/ rendered listing for file
   names only. Less reliable (depends on Dropbox markup) but no app needed.

Usage:
    DROPBOX_ACCESS_TOKEN=... python scripts/inspect_dropbox.py "<shared-link>"
    python scripts/inspect_dropbox.py "<shared-link>"            # no-token

Prints a markdown summary you can paste back into the conversation so we can
decide the vertical and shape the silver/gold layers.
"""
from __future__ import annotations

import io
import json
import os
import re
import sys
from urllib.parse import urlparse

import requests


DROPBOX_API = "https://api.dropboxapi.com/2"
DROPBOX_CONTENT = "https://content.dropboxapi.com/2"


def _post(url, token, body):
    return requests.post(
        url,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        json=body,
        timeout=60,
    )


def token_mode(link_url: str, token: str) -> list[dict]:
    meta_body = {"url": link_url}
    resp = _post(f"{DROPBOX_API}/sharing/get_shared_link_metadata", token, meta_body)
    if resp.status_code != 200:
        raise SystemExit(f"shared_link_metadata error {resp.status_code}: {resp.text[:300]}")

    shared_link = {"url": link_url}
    files: list[dict] = []
    # Shared links don't support recursive=true, so walk subfolders manually.
    pending: list[str] = [""]
    visited: set[str] = set()
    while pending:
        sub = pending.pop()
        if sub in visited:
            continue
        visited.add(sub)
        cursor = None
        while True:
            if cursor is None:
                page = _post(
                    f"{DROPBOX_API}/files/list_folder",
                    token,
                    {"path": sub, "recursive": False, "shared_link": shared_link},
                )
            else:
                page = _post(
                    f"{DROPBOX_API}/files/list_folder/continue",
                    token,
                    {"cursor": cursor},
                )
            if page.status_code != 200:
                # Skip restricted subfolders instead of failing the whole walk
                print(f"# warning: list_folder error {page.status_code} on '{sub}': {page.text[:200]}", file=sys.stderr)
                break
            payload = page.json()
            for e in payload.get("entries", []):
                tag = e.get(".tag")
                if tag == "file":
                    files.append(e)
                elif tag == "folder":
                    child = e.get("path_lower") or ("/" + e.get("name", ""))
                    pending.append(child)
            if not payload.get("has_more"):
                break
            cursor = payload.get("cursor")
    return files


def sample_rows(token: str, link_url: str, rel_path: str, ext: str) -> list[dict]:
    arg = {"url": link_url, "path": rel_path}
    resp = requests.post(
        f"{DROPBOX_CONTENT}/sharing/get_shared_link_file",
        headers={"Authorization": f"Bearer {token}", "Dropbox-API-Arg": json.dumps(arg)},
        timeout=60,
    )
    if resp.status_code != 200:
        return []
    blob = resp.content
    try:
        if ext == "csv":
            import pandas as pd
            return pd.read_csv(io.BytesIO(blob), nrows=3).to_dict(orient="records")
        if ext == "tsv":
            import pandas as pd
            return pd.read_csv(io.BytesIO(blob), sep="\t", nrows=3).to_dict(orient="records")
        if ext in ("xlsx", "xls"):
            import pandas as pd
            sheets = pd.read_excel(io.BytesIO(blob), sheet_name=None, nrows=3)
            return [{"_sheet": s, **r} for s, df in sheets.items() for r in df.to_dict(orient="records")]
        if ext == "parquet":
            import pandas as pd
            return pd.read_parquet(io.BytesIO(blob)).head(3).to_dict(orient="records")
        if ext in ("json", "ndjson", "jsonl"):
            text = blob[:200_000].decode("utf-8", errors="replace")
            if ext in ("ndjson", "jsonl"):
                out = []
                for line in text.splitlines()[:3]:
                    try:
                        out.append(json.loads(line))
                    except Exception:
                        pass
                return out
            try:
                obj = json.loads(text)
            except Exception:
                return []
            if isinstance(obj, list):
                return obj[:3]
            if isinstance(obj, dict):
                return [obj]
    except Exception as exc:
        return [{"_parse_error": str(exc)[:200]}]
    return []


def no_token_mode(link_url: str) -> list[dict]:
    """Best-effort scrape. Dropbox's rendered HTML embeds a JSON blob with
    `filename`, `bytes`, `is_dir` for each child. Returns minimal entries."""
    url = link_url
    if "dl=" in url:
        url = re.sub(r"[?&]dl=\d", "", url)
    resp = requests.get(url, timeout=30, headers={"User-Agent": "Mozilla/5.0"})
    if resp.status_code != 200:
        raise SystemExit(f"unable to fetch shared link (HTTP {resp.status_code})")
    matches = re.findall(r'\{"filename":"([^"]+)","[^"]*":[^,]*,"bytes":(\d+)', resp.text)
    return [{"name": m[0], "size": int(m[1]), ".tag": "file"} for m in matches]


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 2
    link_url = sys.argv[1]
    token = os.environ.get("DROPBOX_ACCESS_TOKEN", "").strip()

    if token:
        files = token_mode(link_url, token)
        mode = "token"
    else:
        files = no_token_mode(link_url)
        mode = "scrape"

    if not files:
        print("No files found.")
        return 1

    print(f"## Dropbox folder inspection ({mode} mode)\n")
    print(f"**Source:** {urlparse(link_url).netloc}{urlparse(link_url).path}\n")
    print(f"**Files:** {len(files)}\n")

    total = 0
    by_ext: dict[str, int] = {}
    rows = []
    for f in files:
        name = f.get("name", "")
        size = int(f.get("size", 0) or 0)
        ext = os.path.splitext(name)[1].lower().lstrip(".") or "(none)"
        by_ext[ext] = by_ext.get(ext, 0) + 1
        total += size
        rows.append((name, ext, size, f.get("path_display") or ""))

    print("| File | Ext | Size (KB) | Path |")
    print("|---|---|---:|---|")
    for name, ext, size, path in sorted(rows):
        print(f"| {name} | {ext} | {size // 1024:,} | {path} |")

    print("\n### Summary")
    print(f"- Total bytes: {total:,}")
    print("- By extension:")
    for ext, n in sorted(by_ext.items(), key=lambda kv: -kv[1]):
        print(f"  - `.{ext}` × {n}")

    if mode == "token":
        print("\n### Sample rows (first 3 per tabular file)\n")
        for f in files:
            name = f.get("name", "")
            ext = os.path.splitext(name)[1].lower().lstrip(".")
            if ext not in ("csv", "tsv", "xlsx", "xls", "json", "ndjson", "jsonl", "parquet"):
                continue
            rel = f.get("path_display") or ""
            if rel and not rel.startswith("/"):
                rel = "/" + rel
            samples = sample_rows(token, link_url, rel, ext)
            print(f"#### {name}")
            if not samples:
                print("_(no preview available)_\n")
                continue
            print("```json")
            print(json.dumps(samples[:3], indent=2, default=str))
            print("```\n")

    return 0


if __name__ == "__main__":
    sys.exit(main())

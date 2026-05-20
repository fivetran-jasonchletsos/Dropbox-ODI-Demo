"""
FDIC BankFind Suite — Fivetran Connector SDK
============================================
Pulls institution, failure, and Summary-of-Deposits data from the FDIC's free
public BankFind Suite API (https://banks.data.fdic.gov/api). No API key.

Tables:
  - institutions          (pk: cert)
  - failures              (pk: cert; faildate is a tiebreaker)
  - summary_of_deposits   (pk: year, cert, uninumbr)

ODI angle: lands as bronze tables in Snowflake next to the Dropbox-sourced
files, so the Sentinel demo can join real regulator data against the customer-
supplied shared-drive content. This is the "real-API" fallback path for the
Dropbox-blocked download scenario.

Configuration (configuration.json):
    {
      "sod_years": "2022,2023,2024",
      "max_pages_per_table": "20",
      "rate_sleep_seconds": "0.1"
    }
"""
from __future__ import annotations

import time
from typing import Iterator
from datetime import datetime, timezone

import requests
from fivetran_connector_sdk import Connector, Operations as op, Logging as log


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

FDIC_BASE = "https://banks.data.fdic.gov/api"
PAGE_LIMIT = 10_000          # FDIC max per request
HTTP_TIMEOUT = 30
DEFAULT_SOD_YEARS = "2022,2023,2024"
DEFAULT_MAX_PAGES = 20
DEFAULT_SLEEP = 0.1

INSTITUTION_FIELDS = (
    "CERT,NAME,NAMEHCR,CITY,STALP,ZIP,BKCLASS,CHARTER,ESTYMD,"
    "ASSET,DEP,EQ,NETINC,ROA,ROE,REGAGNT,FED,FDICDBS"
)
FAILURE_FIELDS = (
    "CERT,NAME,CITY,STALP,FAILDATE,COST,CHCLASS1,QBFASSET,QBFDEP,"
    "RESTYPE,SAVR"
)
SOD_FIELDS = (
    "YEAR,CERT,NAMEFULL,BRNUM,UNINUMBR,BRANNAME,ADDRESBR,CITYBR,"
    "STALPBR,ZIPBR,DEPSUMBR,BKMO,BKCLASS,STCNTYBR"
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get(url: str) -> requests.Response | None:
    """HTTP GET with one retry on 429 / 5xx (5s backoff)."""
    for attempt in (1, 2):
        try:
            resp = requests.get(url, timeout=HTTP_TIMEOUT)
        except requests.exceptions.RequestException as exc:
            log.warning(f"Request error: {exc}")
            if attempt == 2:
                return None
            time.sleep(5)
            continue

        if resp.status_code == 429 or resp.status_code >= 500:
            log.warning(f"HTTP {resp.status_code} on {url} — retry in 5s")
            if attempt == 2:
                return None
            time.sleep(5)
            continue
        if resp.status_code >= 400:
            log.warning(f"HTTP {resp.status_code} on {url} — giving up")
            return None
        return resp
    return None


def _records(payload: dict) -> list[dict]:
    """FDIC BankFind responses wrap each row as {data: {...}, score: ...}."""
    raw = payload.get("data") or []
    return [r.get("data", r) for r in raw if isinstance(r, dict)]


def _lower_keys(row: dict) -> dict:
    return {k.lower(): v for k, v in row.items()}


def _yyyymmdd_to_iso(val) -> str | None:
    """FDIC dates land as 'yyyymmdd' integers/strings; emit ISO 'YYYY-MM-DD'."""
    if val is None or val == "":
        return None
    s = str(val).strip()
    # Some endpoints return ISO already, some return epoch-y strings.
    if "-" in s and len(s) >= 10:
        return s[:10]
    digits = "".join(ch for ch in s if ch.isdigit())
    if len(digits) >= 8:
        d = digits[:8]
        try:
            return f"{d[0:4]}-{d[4:6]}-{d[6:8]}"
        except Exception:  # noqa: BLE001
            return None
    return None


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


# ---------------------------------------------------------------------------
# Page iterators
# ---------------------------------------------------------------------------

def _paginate(url_builder, table: str, start_offset: int, max_pages: int,
              sleep_seconds: float) -> Iterator[tuple[int, list[dict]]]:
    """Yield (offset, rows) for each page until short page or page cap."""
    offset = start_offset
    pages = 0
    while pages < max_pages:
        url = url_builder(offset)
        log.info(f"[{table}] fetching offset={offset} (page {pages + 1}/{max_pages})")
        resp = _get(url)
        if not resp:
            log.warning(f"[{table}] page failed at offset={offset}, stopping")
            return
        try:
            payload = resp.json()
        except ValueError:
            log.warning(f"[{table}] non-JSON response at offset={offset}")
            return
        rows = _records(payload)
        yield offset, rows
        if len(rows) < PAGE_LIMIT:
            return
        offset += PAGE_LIMIT
        pages += 1
        time.sleep(sleep_seconds)


# ---------------------------------------------------------------------------
# Per-table sync
# ---------------------------------------------------------------------------

def sync_institutions(state: dict, max_pages: int, sleep_s: float):
    tbl = "institutions"
    sub = state.get(tbl, {}) or {}
    start = int(sub.get("last_offset") or 0)

    def url(offset: int) -> str:
        return (
            f"{FDIC_BASE}/institutions?filters=ACTIVE:1"
            f"&limit={PAGE_LIMIT}&offset={offset}&fields={INSTITUTION_FIELDS}"
        )

    total = 0
    for offset, rows in _paginate(url, tbl, start, max_pages, sleep_s):
        for raw in rows:
            row = _lower_keys(raw)
            row["estymd"] = _yyyymmdd_to_iso(row.get("estymd"))
            if row.get("cert") is None:
                continue
            yield op.upsert(tbl, row)
            total += 1
        state[tbl] = {
            "last_offset": offset + len(rows),
            "last_synced_at": _now_iso(),
        }
        yield op.checkpoint(state)
    # Reset for next full refresh
    state[tbl] = {"last_offset": 0, "last_synced_at": _now_iso()}
    yield op.checkpoint(state)
    log.info(f"[{tbl}] upserted {total} rows")


def sync_failures(state: dict, max_pages: int, sleep_s: float):
    tbl = "failures"
    sub = state.get(tbl, {}) or {}
    start = int(sub.get("last_offset") or 0)

    def url(offset: int) -> str:
        return (
            f"{FDIC_BASE}/failures?limit={PAGE_LIMIT}&offset={offset}"
            f"&fields={FAILURE_FIELDS}"
        )

    total = 0
    for offset, rows in _paginate(url, tbl, start, max_pages, sleep_s):
        for raw in rows:
            row = _lower_keys(raw)
            row["faildate"] = _yyyymmdd_to_iso(row.get("faildate"))
            if row.get("cert") is None:
                continue
            yield op.upsert(tbl, row)
            total += 1
        state[tbl] = {
            "last_offset": offset + len(rows),
            "last_synced_at": _now_iso(),
        }
        yield op.checkpoint(state)
    state[tbl] = {"last_offset": 0, "last_synced_at": _now_iso()}
    yield op.checkpoint(state)
    log.info(f"[{tbl}] upserted {total} rows")


def sync_sod(state: dict, years: list[int], max_pages: int, sleep_s: float):
    tbl = "summary_of_deposits"
    sub = state.get(tbl, {}) or {}
    last_year = sub.get("last_year")
    last_offset = int(sub.get("last_offset") or 0)

    grand_total = 0
    for year in years:
        # If we previously progressed past this year, skip.
        if last_year and year < int(last_year):
            continue
        start = last_offset if last_year and int(last_year) == year else 0

        def url(offset: int, _y=year) -> str:
            return (
                f"{FDIC_BASE}/sod?limit={PAGE_LIMIT}&offset={offset}"
                f"&filters=YEAR:{_y}&fields={SOD_FIELDS}"
            )

        for offset, rows in _paginate(url, f"{tbl}/{year}", start, max_pages, sleep_s):
            for raw in rows:
                row = _lower_keys(raw)
                if row.get("year") is None or row.get("cert") is None or row.get("uninumbr") is None:
                    continue
                yield op.upsert(tbl, row)
                grand_total += 1
            state[tbl] = {
                "last_year": year,
                "last_offset": offset + len(rows),
                "last_synced_at": _now_iso(),
            }
            yield op.checkpoint(state)
        # Year complete — advance year cursor, reset offset.
        last_offset = 0
        last_year = year
        state[tbl] = {
            "last_year": year,
            "last_offset": 0,
            "last_synced_at": _now_iso(),
        }
        yield op.checkpoint(state)

    state[tbl] = {"last_year": None, "last_offset": 0, "last_synced_at": _now_iso()}
    yield op.checkpoint(state)
    log.info(f"[{tbl}] upserted {grand_total} rows across years={years}")


# ---------------------------------------------------------------------------
# SDK entry points
# ---------------------------------------------------------------------------

def schema(configuration: dict) -> list[dict]:
    return [
        {"table": "institutions",        "primary_key": ["cert"]},
        {"table": "failures",            "primary_key": ["cert", "faildate"]},
        {"table": "summary_of_deposits", "primary_key": ["year", "cert", "uninumbr"]},
    ]


def update(configuration: dict, state: dict):
    state = state or {}
    max_pages = int(configuration.get("max_pages_per_table") or DEFAULT_MAX_PAGES)
    sleep_s = float(configuration.get("rate_sleep_seconds") or DEFAULT_SLEEP)
    years_raw = configuration.get("sod_years") or DEFAULT_SOD_YEARS
    try:
        years = sorted({int(y.strip()) for y in str(years_raw).split(",") if y.strip()})
    except ValueError as exc:
        raise RuntimeError(f"sod_years must be a comma list of integers; got {years_raw!r}") from exc

    log.info(
        f"FDIC sync start | sod_years={years} max_pages_per_table={max_pages} "
        f"sleep={sleep_s}s"
    )

    yield from sync_institutions(state, max_pages, sleep_s)
    yield from sync_failures(state, max_pages, sleep_s)
    yield from sync_sod(state, years, max_pages, sleep_s)

    log.info("FDIC sync complete")


connector = Connector(update=update, schema=schema)


if __name__ == "__main__":
    connector.debug()

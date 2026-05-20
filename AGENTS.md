# Agent notes — Dropbox-ODI-Demo

## Repo intent

ODI demo where the source is a Dropbox shared folder, not an API. Audience is
CDO/CIO buyers, so the demo surface is the destination + persona app, not the
Fivetran sync UI.

## Branding rules

- Architecture diagrams must show **"dbt labs"** on BOTH bronze→silver and
  silver→gold edges (this matches the dbt Labs merger guidance).
- Destination is **Snowflake**.
- Do NOT lead the demo with the Fivetran connector UI. Lead with the gold
  layer and the persona app; the connector is the plumbing.

## Connector design

`connectors/dropbox/connector.py` supports two auth modes:

1. **API token mode** — full Dropbox app token + `folder_path`. Production-
   shaped, supports incremental sync via `cursor` from `/2/files/list_folder`.
2. **Shared-link mode** — public/team shared URL. Demo-friendly. Uses
   `/2/sharing/list_shared_link_files`. State is file `rev` per path.

Supported file types (auto-detected by extension):
- `.csv` / `.tsv` — pandas read_csv, one bronze table per file
- `.xlsx` / `.xls` — one bronze table per sheet, named `<file_stem>__<sheet>`
- `.json` / `.ndjson` — flattened to top-level records
- `.parquet` — pyarrow
- `.pdf` — metadata only into `_files` (text extraction is out of scope here)

Every sync also writes a row per file to bronze `_files` with `path`, `name`,
`extension`, `size_bytes`, `rev`, `client_modified`, `row_count`,
`column_count`, `sheet_name` (xlsx only), `synced_at`.

## Once we know the data

After running `scripts/inspect_dropbox.py`:

1. Decide the vertical (matches an existing persona pattern — Atlas Risk,
   Meridian, Lighthouse, etc., or new).
2. Add silver staging models — one `stg_<file>` per bronze table, applying
   types and renames.
3. Add gold marts shaped around the vertical's KPIs.
4. Add `transform/metrics/*.yml` semantic layer definitions.
5. Build the persona app (Streamlit or Next/Vite — match the existing demo
   the vertical maps to).

## Local dev

- pyenv 3.12.11 is the global Python (per user memory). dbt + Fivetran SDK
  share that env. fivetran-connector-sdk has a pathspec conflict with
  dbt-core / black — install the connector deps in a separate venv:
  `python -m venv connectors/dropbox/.venv && source connectors/dropbox/.venv/bin/activate && pip install -r connectors/dropbox/requirements.txt`

# Dropbox connector

Custom Fivetran Connector SDK that ingests a Dropbox folder as bronze tables
in Snowflake.

## Auth modes

| Mode | When to use | Required config |
|---|---|---|
| `token` | Production / Dropbox app you control | `dropbox_access_token`, `folder_path` |
| `shared_link` | Demos against a folder you don't own | `dropbox_access_token` (any app token with `sharing.read` + `files.content.read`), `shared_link_url` |

Get a token: https://www.dropbox.com/developers/apps → create app → permissions
tab → enable `files.content.read`, `files.metadata.read`, `sharing.read` →
"Generate access token".

## Local debug

```bash
cd connectors/dropbox
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp configuration.example.json configuration.json
# edit configuration.json
python connector.py            # uses Fivetran's debug runner, writes to ./warehouse.db
```

## Deploy to Fivetran

```bash
fivetran connectors create \
  --connector dropbox_odi_demo \
  --destination <SNOWFLAKE_DEST_NAME> \
  --configuration configuration.json
fivetran deploy --connection dropbox_odi_demo
```

## Tables produced

- `_files` — metadata row per file in the folder (path, rev, size, row/col
  counts, status). Primary key: `path`.
- One bronze table per tabular file, named after the file stem
  (snowflake-safe). XLSX workbooks produce one table per sheet:
  `<stem>__<sheet>`.

Each row in a parsed table includes `_source_file` and `_source_rev` so
silver models can join back to `_files`.

## Incremental behavior

State stores `{path: rev}`. On the next sync, files whose `rev` hasn't
changed are skipped. New files and re-uploaded files are re-ingested in
full (Dropbox doesn't give us row-level diffs).

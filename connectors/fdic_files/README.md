# FDIC Files connector

Fivetran Connector SDK project that reads FDIC public CSVs from a local
directory and lands them in **Fivetran MDLS** (Managed Data Lake Service —
Apache Iceberg on S3, registered in AWS Glue Data Catalog).

Acts as a stand-in for the Dropbox connector while that folder is access-
restricted. Produces the **identical bronze schema**, so dbt's silver and
gold models are unchanged.

## Tables produced

| Table | Primary key | Source file |
|---|---|---|
| `fdic_failed_bank_list` | `cert` | `FDIC Failed Bank List.csv` |
| `fdic_institutions` | `cert` | `INSTITUTIONS2.CSV` |
| `fdic_summary_of_deposits` | `(year, cert, uninumbr)` | `FDIC Summary of Deposits.csv` |
| `fdic_offices` | `uninum` | `OFFICES2_ALL.CSV` (when `include_quarterly_reports=true`) |
| `all_reports_<yyyymmdd>_<name>` | `(cert, repdte)` | `All_Reports_*.csv` (when `include_quarterly_reports=true`) |
| `_files` | `path` | Connector metadata for every file synced |

Each row in every parsed table also carries `_source_file` and `_source_signature`
so the dbt `mart_file_lineage` model can trace gold rows back to source.

## Configuration

```json
{
  "source_directory": "/abs/path/to/seed_data",
  "include_quarterly_reports": "true",
  "max_rows_per_file": "250000"
}
```

| Field | Default | Notes |
|---|---|---|
| `source_directory` | `<repo>/seed_data` | Where to read CSVs from. Must exist. |
| `include_quarterly_reports` | `false` | When `true`, also land `All_Reports_*.csv` and `OFFICES2_ALL.CSV`. |
| `max_rows_per_file` | `250000` | Safety cap. Demo data is well under this. |

## Local debug

```bash
cd connectors/fdic_files
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp configuration.example.json configuration.json
# edit configuration.json if your seed_data path differs
python connector.py            # writes to ./warehouse.db for inspection
```

## Deploy to Fivetran (MDLS destination)

```bash
# Authenticate once
fivetran auth login

# Deploy as a custom connector
fivetran connectors create \
  --connector jason_chletsos_sentinel_fdic_files \
  --destination <your-mdls-destination-name> \
  --configuration configuration.json
fivetran deploy --connection jason_chletsos_sentinel_fdic_files
```

Replace `<your-mdls-destination-name>` with your MDLS destination (e.g.
`fortitude_fawn` if you're sharing the destination used by the
FinancialServices-MDLS-DuckDB demo).

After the first sync, MDLS will register Iceberg tables in Glue under the
schema prefix `jason_chletsos_sentinel_fdic_files` (or whatever Fivetran's
schema-prefix policy resolves to).

## Incremental behavior

State stores `{path: "<size>:<mtime>"}`. On the next sync, files whose
size+mtime hasn't changed are skipped. Touching or re-uploading a CSV
triggers a full re-ingest of that file (FDIC files don't expose row-level
diffs). Per-file `_FILES` row is updated on every sync regardless.

## When to swap back to the Dropbox connector

If the Dropbox folder owner adds your app to the team's allowed-apps list
(or provides a folder you own), point Fivetran at `connectors/dropbox/`
instead. Bronze schema and silver/gold dbt models stay the same — only the
ingestion path changes.

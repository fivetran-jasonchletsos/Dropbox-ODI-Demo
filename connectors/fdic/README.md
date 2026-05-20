# FDIC connector

Custom Fivetran Connector SDK that pulls the FDIC's free public **BankFind
Suite API** (`https://banks.data.fdic.gov/api`) and lands three bronze tables
in Snowflake.

This is the **real-API fallback path** for the Sentinel demo. Dropbox's team
policy can block file downloads on a shared link; this connector lets the
demo run end-to-end against authoritative regulator data when Dropbox is
unavailable. No API key — the FDIC API is keyless and unauthenticated.

## Tables produced

| Table | Endpoint | Primary key | Notes |
|---|---|---|---|
| `institutions` | `/institutions?filters=ACTIVE:1` | `cert` | One row per active FDIC-insured institution. `estymd` converted to ISO date. |
| `failures` | `/failures` | `cert`, `faildate` | One row per bank failure (full history). `faildate` ISO. |
| `summary_of_deposits` | `/sod?filters=YEAR:<year>` | `year`, `cert`, `uninumbr` | One row per branch per year. Configurable year list. |

All column names are lower-cased on landing so dbt staging models stay clean.

## Configuration

Copy `configuration.example.json` to `configuration.json` and tune:

```json
{
  "sod_years": "2022,2023,2024",
  "max_pages_per_table": "20",
  "rate_sleep_seconds": "0.1"
}
```

| Key | Default | Meaning |
|---|---|---|
| `sod_years` | `"2022,2023,2024"` | Comma list of years to pull from the Summary of Deposits endpoint. |
| `max_pages_per_table` | `"20"` | Safety cap. 20 pages × 10k rows = 200k per table per year, well above current counts. |
| `rate_sleep_seconds` | `"0.1"` | Inter-page sleep. FDIC is generous; 100 ms is plenty. |

## Local debug

```bash
cd connectors/fdic
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp configuration.example.json configuration.json
python connector.py            # Fivetran's debug runner, writes to ./warehouse.db
```

Want to sanity-check the API without spinning up the SDK runner?

```bash
python run_local.py            # dumps page 1 of each endpoint to ./sample/*.json
```

## Deploy to Fivetran

```bash
fivetran connectors create \
  --connector fdic_odi_demo \
  --destination <SNOWFLAKE_DEST_NAME> \
  --configuration configuration.json
fivetran deploy --connection fdic_odi_demo
```

## Sync behavior

The FDIC API has no incremental cursor, so each sync is effectively a full
refresh. The connector still **checkpoints state after every page** so a
mid-sync interruption resumes from the last completed page rather than
restarting at offset 0. On a successful sweep the offset is reset so the
next run picks up new rows.

Single retry on 429 / 5xx with a 5-second sleep. 4xx (other than 429) is
treated as terminal for that request — the connector logs and moves on.

## Lake snapshot

After a first sync, bronze in Snowflake holds roughly:

- `institutions` — ~4,500 active US insured institutions
- `failures` — ~570 failures since 2001 (the API returns full history)
- `summary_of_deposits` — ~80k branches per year × number of years configured

dbt then conforms these into the silver / gold layers consumed by the
Sentinel app (`dim_institution`, `fct_failures`, `mart_state_risk`, …).

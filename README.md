# Sentinel · Dropbox-ODI-Demo

End-to-end demonstration of **Fivetran Open Data Infrastructure (ODI)** using
a Dropbox shared folder of FDIC public data as the source. Files land in
**Fivetran MDLS** (Apache Iceberg in S3 + AWS Glue Data Catalog), **Snowflake
reads them in place** via External Volume + Glue catalog integration, and
**dbt labs** conforms them on both the bronze → silver and silver → gold edges.
Sentinel is the React app on top.

The customer-facing surface (Sentinel) is themed in **University of Michigan
maize and blue** because this demo is a gift for a Wolverine who teaches at
U-M. There's a hidden Tecmo Bowl mini-game — Michigan vs. Ohio State —
unlocked with the Konami code (↑ ↑ ↓ ↓ ← → ← → B A).

## Architecture

```
   ┌──────────────────────────────────────────────────────────────┐
   │  Dropbox shared folder  (583 files · 76 GB · 44 formats)     │
   │  FDIC: Failed Bank List · Institutions · Summary of Deposits │
   └────────────────────────────┬─────────────────────────────────┘
                                │  Fivetran Connector SDK
                                │   • connectors/dropbox  (primary)
                                │   • connectors/fdic_files (local stand-in)
                                │   • connectors/fdic     (BankFind API fallback)
                                ▼
   ┌──────────────────────────────────────────────────────────────┐
   │  Fivetran MDLS — Apache Iceberg in S3 + AWS Glue Catalog     │
   │    bronze.fdic_institutions          (PK: cert)              │
   │    bronze.fdic_failed_bank_list      (PK: cert)              │
   │    bronze.fdic_summary_of_deposits   (PK: year,cert,uninumbr)│
   │    bronze._files                     (per-file provenance)   │
   └────────────────────────────┬─────────────────────────────────┘
                                │  dbt labs · bronze → silver (views)
                                ▼
   ┌──────────────────────────────────────────────────────────────┐
   │  ANALYTICS.SILVER — staging + intermediate (Snowflake)       │
   │  stg_institutions · stg_failed_banks · stg_summary_of_deposits│
   │  int_institution_branches · int_state_failures               │
   └────────────────────────────┬─────────────────────────────────┘
                                │  dbt labs · silver → gold (tables)
                                ▼
   ┌──────────────────────────────────────────────────────────────┐
   │  ANALYTICS.GOLD — marts + semantic layer (9 metrics)         │
   │  dim_institution · fct_failures · fct_branches               │
   │  mart_state_risk · mart_institution_risk_score               │
   │  mart_file_lineage  (ODI provenance hero)                    │
   └────────────────────────────┬─────────────────────────────────┘
                                │  Same Iceberg tables · pick your engine
        ┌───────────────┬───────┴────────┬──────────────┬────────────┐
        ▼               ▼                ▼              ▼            ▼
   Snowflake        DuckDB           Athena         Trino         Spark
   (primary)       (laptop)       (serverless)    (cluster)    (cluster)
                                │
                                ▼
   ┌──────────────────────────────────────────────────────────────┐
   │  Sentinel — React + Vite + Tailwind v4                       │
   │  Michigan maize & blue · 9 routes · Konami → Tecmo Bowl      │
   └──────────────────────────────────────────────────────────────┘
```

## Layout

| Path | What lives there |
|---|---|
| `connectors/dropbox/` | Custom SDK — primary Dropbox source |
| `connectors/fdic_files/` | Custom SDK — reads `seed_data/*.csv` and lands them in MDLS (used while the Dropbox folder is team-restricted) |
| `connectors/fdic/` | Custom SDK — pulls FDIC BankFind Suite API directly (fallback) |
| `infra/snowflake_setup.sql` | Snowflake warehouse + roles + grants |
| `infra/snowflake_iceberg_setup.sql` | External Volume + Glue catalog integration + Iceberg table registration |
| `infra/mdls/` | Terraform — S3 bucket, Glue catalog DB, IAM roles for both Fivetran-write and Snowflake-read |
| `infra/README.md` | Step-by-step IAM + Snowflake-reads-Iceberg setup |
| `transform/` | dbt-snowflake project: 4 bronze · 5 silver · 6 gold · 9 semantic metrics · 98 tests |
| `sentinel-app/frontend/` | Vite + React + TS + Tailwind v4 — the demo surface |
| `sentinel-app/scripts/` | `build_snapshot.py` (Snowflake → JSON) + `_synthetic.py` fallback |
| `seed_data/` | Real FDIC public CSVs (Failed Bank List, Institutions, SOD, Q1-2015 quarterly reports) |
| `SENTINEL_DEMO_10MIN.md` | 10-minute demo cheat card with minute-by-minute outline |
| `SENTINEL_DEMO_CHEAT_CARD.md` | One-printed-page summary |

## How you actually see it

### Option 1 — GitHub Pages (zero install)

Push to `main` and `.github/workflows/deploy.yml` builds Sentinel and
publishes it at `https://<your-org>.github.io/Dropbox-ODI-Demo/`. No
credentials, no local setup, no dependencies. (Pages must be enabled in
the repo's Settings → Pages → Source: GitHub Actions.)

### Option 2 — Open the pre-built `dist/` locally

The production build is committed under `sentinel-app/frontend/dist/`,
matching how Atlas Risk and Meridian ship. Serve it with any static
server:

```bash
cd sentinel-app/frontend/dist
python3 -m http.server 8000
# open http://localhost:8000
```

### Option 3 — Live-reload dev

```bash
cd sentinel-app/frontend
npm ci && npm run dev    # http://localhost:5173
```

All three modes run against the committed JSON snapshot under
`public/data/`. Try the Konami code on any page. 〽️

## Full ODI deployment

```bash
# 1. Provision AWS (S3 + Glue + IAM for Fivetran-write and Snowflake-read)
cd infra/mdls
cp terraform.tfvars.example terraform.tfvars   # fill in your values
terraform init && terraform apply

# 2. Create the Fivetran MDLS destination (UI) pointing at the bucket + Glue DB
#    See infra/mdls/README.md for the exact UI fields.

# 3. Deploy a connector to land bronze.fdic_* tables
cd ../../connectors/fdic_files
cp configuration.example.json configuration.json
fivetran deploy --connection jason_chletsos_sentinel_fdic_files

# 4. Wire Snowflake to read the Iceberg tables in place
cd ../..
snowsql -f infra/snowflake_setup.sql
snowsql -f infra/snowflake_iceberg_setup.sql

# 5. Build silver + gold with dbt
cd transform && dbt deps && dbt seed && dbt build --target prod

# 6. Pull a fresh snapshot from gold and refresh the app
cd ../sentinel-app && python scripts/build_snapshot.py
cd frontend && npm run build
```

## ODI value props the site illustrates

| Pillar | Where in Sentinel |
|---|---|
| **Open storage** | `/architecture` — Iceberg tables live in *your* S3, not Snowflake-managed storage |
| **Open catalog** | `/architecture` — AWS Glue Data Catalog (also works with Iceberg REST catalogs) |
| **Multi-engine** | `/architecture` — Snowflake, DuckDB, Athena, Trino, Spark tabs with sample SQL on the same gold table |
| **Provenance** | `/catalog` — every gold row traces back through `mart_file_lineage` to the source file in `_files` |
| **AI-ready** | `/institutions/:certId` — gold-layer narratives generated from the same metrics dbt's semantic layer exposes |
| **No lock-in** | `/architecture` — MDS-vs-ODI comparison side-by-side; Snowflake is one consumer, not the path |

## Data sources

| Source | Tables | Coverage |
|---|---|---|
| FDIC Institutions (INSTITUTIONS2) | `fdic_institutions` | 27,598 FDIC-insured banks, active + historical |
| FDIC Summary of Deposits | `fdic_summary_of_deposits` | 97,340 branch rows with lat/long for 2012-2024 |
| FDIC Failed Bank List | `fdic_failed_bank_list` | 540 bank failures since 2000 |
| FDIC Quarterly Reports (Q1-2015) | `all_reports_20150331_*` | 6 ratio/balance reports × ~6,400 banks each — powers the risk score |

All public-domain, sourced from fdic.gov.

## Easter egg

Konami code on any page → ↑ ↑ ↓ ↓ ← → ← → B A. **Go Blue.** 〽️

## License

Demonstration code. Not for production trading or research decisions.

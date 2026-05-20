# Sentinel — One-Page Cheat Card

US bank-risk persona on the Dropbox-ODI-Demo. Print this. Bring it to the call.

## Architecture (the only diagram that matters)

```
   Dropbox shared folder  ── 583 files · 44 formats · 76 GB ───────┐
   (primary source)                                                │
                                                                   │
   FDIC BankFind API     ── institutions · failures · SOD ────┐    │
   (fallback connector)                                       │    │
                                                              ▼    ▼
                              ┌───────────────────────────────────────┐
                              │  Fivetran Custom Connector SDK        │
                              └────────────────────┬──────────────────┘
                                                   ▼
                              ┌───────────────────────────────────────┐
                              │  Snowflake — BRONZE schema            │
                              │  one table per parsed file +          │
                              │  _files metadata · FDIC raw           │
                              └────────────────────┬──────────────────┘
                                                   │  dbt labs  (bronze → silver)
                                                   ▼
                              ┌───────────────────────────────────────┐
                              │  Snowflake — SILVER schema            │
                              │  conformed staging + intermediates    │
                              └────────────────────┬──────────────────┘
                                                   │  dbt labs  (silver → gold)
                                                   ▼
                              ┌───────────────────────────────────────┐
                              │  Snowflake — GOLD schema              │
                              │  dim_institution · fct_failures       │
                              │  mart_state_risk · mart_file_lineage  │
                              └────────────────────┬──────────────────┘
                                                   ▼
                              ┌───────────────────────────────────────┐
                              │  Sentinel app (React + Vite)          │
                              │  9 routes · static JSON snapshot      │
                              └───────────────────────────────────────┘

   Engines on the same gold tables:  Snowflake · Databricks · Athena · DuckDB · Cortex
```

## Connectors (3, listed in demo order)

| Role | Connector | Where it lives | Status |
|---|---|---|---|
| Primary | Dropbox shared link / app token | `connectors/dropbox/` | Built |
| Secondary | FDIC BankFind API (keyless, public) | `connectors/fdic/` | Built — this PR |
| Fallback | Synthetic generator (seed=42) | `sentinel-app/scripts/_synthetic.py` | Built |

## Gold tables (the marts dbt labs builds)

| Table | Grain | Used by |
|---|---|---|
| `dim_institution` | one row per FDIC cert | `/institutions`, `/institutions/<cert>` |
| `fct_failures` | one row per failure event | `/states`, `/institutions/<cert>` |
| `mart_state_risk` | one row per state | `/states`, summary tile |
| `mart_file_lineage` | one row per Dropbox file | `/catalog`, `/pipeline` |
| `mart_institution_quarterly` | cert × quarter | institution detail trends |
| `mart_pipeline_health` | one row per layer | `/pipeline` |
| `mart_summary_tiles` | one row | `/` KPI tiles |

## dbt semantic-layer metrics (the 7)

1. `failure_rate_5y` — failures last 60 months / FDIC-active institutions
2. `weighted_capital_ratio` — assets-weighted CET1 across the cohort
3. `deposit_concentration_hhi` — Herfindahl across top 10 by state
4. `branch_density_per_state` — branches / state population
5. `quarterly_risk_drift` — q/q Δ risk_score, cohort-level
6. `parsed_file_ratio` — parsed bronze tables / total cataloged files
7. `gold_freshness_minutes` — max minutes since last dbt build

## Frontend routes (the 9)

| Route | What it shows |
|---|---|
| `/` | KPI tiles + file-inventory chart |
| `/catalog` | All 583 files, searchable, parsed/metadata badge |
| `/institutions` | Sortable risk-ranked list |
| `/institutions/<cert>` | 8-quarter trend, peer failures, AI summary |
| `/states` | 51-state heatmap by risk_index |
| `/states/<state>` | State detail panel |
| `/pipeline` | 4-layer health, test pass count, sim-failure button |
| `/architecture` | The money page — diagram + 5-engine tabs |
| `/about` | Stack, contributors, license |

## Quick start (zero-creds path)

```bash
python sentinel-app/scripts/build_snapshot.py    # writes JSON snapshot
cd sentinel-app/frontend && npm ci && npm run dev
```

## The seven words to land

**Storage is open. Catalog is open. Compute is a choice.**

## Hard guardrails

- "dbt labs" on **both** edges, every diagram. Always say "dbt labs."
- Lead with destination + persona app. Never open the Fivetran sync UI.
- 9 routes, 7 metrics, 3 connectors, 4 layers, 1 thesis. Don't pad.

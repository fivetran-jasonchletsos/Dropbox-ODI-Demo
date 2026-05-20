# Sentinel — dbt transformation layer

dbt-snowflake 1.8+ project that powers the **Sentinel** US bank-risk
ODI demo. The medallion architecture lands FDIC public datasets in
Snowflake via the Fivetran Dropbox connector, conforms them in silver,
and produces a gold layer that the Sentinel app reads directly.

## Medallion layout

```
bronze/   pass-through views over Fivetran's landed tables
silver/   typed + conformed views (one stg_ per source, plus int_)
gold/     materialized tables: dim, fct, mart
```

| layer  | materialization | schema     |
|--------|-----------------|------------|
| bronze | view            | `bronze`   |
| silver | view            | `silver`   |
| gold   | table           | `gold`     |
| seeds  | table           | `seeds`    |

## Sources

| bronze table                  | source                                   |
|-------------------------------|------------------------------------------|
| `_files`                      | Fivetran Dropbox connector metadata      |
| `fdic_failed_bank_list`       | FDIC Failed Bank List CSV                |
| `fdic_institutions`           | FDIC `INSTITUTIONS2.CSV`                 |
| `fdic_summary_of_deposits`    | FDIC Summary of Deposits CSV             |

The three FDIC tables arrive as files in a Dropbox folder. Fivetran
parses them and writes them into `ODI_DROPBOX.BRONZE.*` with a row in
`_FILES` per sync.

## Dev vs. prod: the seed/source switch

Each bronze pass-through carries a Jinja switch:

```sql
{% if target.name == 'dev' %}
  {{ ref('fdic_institutions') }}
{% else %}
  {{ source('bronze', 'fdic_institutions') }}
{% endif %}
```

In `target: dev` the entire pipeline runs against the seed CSVs in
`seeds/` so the demo works offline and on any reviewer's laptop.
In any other target it reads from the real bronze tables.

## Risk score formula

The institution risk score is a 0–100 composite computed in
`mart_institution_risk_score.sql`:

```
risk_score = round(
    20 * (1 - least(capital_ratio_pct / 12, 1.0))      -- thin capital
  + 25 * least(npl_ratio_pct / 5, 1.0)                  -- credit losses
  + 20 * greatest(0, (1 - roa_pct / 1.0))               -- weak earnings
  + 20 * peer_5y_failure_rate_pct / 10.0                -- state-cluster failure rate
  + 15 * size_concentration_penalty                     -- charter-class + size
, 0)
```

Bucketing:

| score range | tier      |
|-------------|-----------|
| `< 25`      | `low`     |
| `25 – 49`   | `watch`   |
| `50 – 74`   | `elevated`|
| `>= 75`     | `high`    |

`npl_ratio_pct` is approximated from negative net income because the
public CSV does not carry a non-performing-loans column. When real
FDIC call-report NPL data arrives we swap the approximation for the
true field; the rest of the formula is unchanged.

## How to run

```bash
# from transform/
dbt deps
dbt seed --target dev
dbt build --target dev
```

`dbt build` runs seeds, silver, gold, and every test in dependency
order. After a green run, every Sentinel-app query against
`gold.dim_institution`, `gold.mart_state_risk`, and
`gold.mart_file_lineage` will work end-to-end against the seeded
data alone.

## Tests

- `not_null` + `unique` on every primary key (`cert`, surrogate keys).
- `accepted_values` on `charter_class` (`N`, `NM`, `SM`, `SB`, `SA`).
- `accepted_values` on `risk_tier` (`low`, `watch`, `elevated`, `high`).
- `accepted_values` on `asset_class` (5 buckets).
- `relationships` from `fct_branches.cert` → `dim_institution.cert`.
- `dbt_utils.accepted_range` 0–100 on `risk_score` and `risk_index`.

## Semantic layer

`metrics/sentinel_metrics.yml` defines seven first-class metrics:

| metric                         | type    | source model              |
|--------------------------------|---------|---------------------------|
| `institutions_tracked`         | simple  | `dim_institution`         |
| `total_deposits_b`             | derived | `dim_institution`         |
| `failed_bank_count`            | simple  | `fct_failures`            |
| `failure_rate_5y`              | ratio   | `fct_failures` + dim      |
| `avg_capital_ratio`            | simple  | `dim_institution`         |
| `avg_roa`                      | simple  | `dim_institution`         |
| `high_risk_institution_count`  | simple  | `dim_institution`         |

## ODI provenance

`mart_file_lineage` joins `_files` to the gold tables that consumed
each file so the Sentinel app can show "this row traces back to file
X uploaded on Y" — the headline ODI demo moment.

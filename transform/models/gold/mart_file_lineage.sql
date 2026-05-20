{{ config(materialized='table') }}

-- ============================================================
-- The ODI provenance hero.
--
-- Joins the `_files` Fivetran metadata table to the gold tables that
-- were derived from each file so the Sentinel app can answer
-- "this gold row traces back to file X, uploaded on Y."
--
-- One row per (table_name, file path) with row counts, sync time,
-- and the gold-layer table that consumed the file.
-- ============================================================

with files as (

    select *
    from {{ ref('br_files') }}

),

-- Map the bronze table names to the gold tables they feed. Adjust if
-- new bronze sources are added.
table_to_gold as (

    select column1 as bronze_table, column2 as gold_table, column3 as gold_grain
    from (values
        ('FDIC_FAILED_BANK_LIST',     'fct_failures',  'one row per failure event'),
        ('FDIC_INSTITUTIONS',         'dim_institution','one row per cert'),
        ('FDIC_SUMMARY_OF_DEPOSITS',  'fct_branches',  'one row per branch')
    ) v

),

-- Pull simple counts from each gold table so the lineage row can show
-- "X bronze rows -> Y gold rows" in the UI.
gold_counts as (

    select 'fct_failures'    as gold_table, count(*) as gold_row_count
    from {{ ref('fct_failures') }}
    union all
    select 'dim_institution' as gold_table, count(*) as gold_row_count
    from {{ ref('dim_institution') }}
    union all
    select 'fct_branches'    as gold_table, count(*) as gold_row_count
    from {{ ref('fct_branches') }}

),

joined as (

    select
        f.path                                                      as source_file_path,
        f.name                                                      as source_file_name,
        f.extension,
        f.size_bytes,
        f.rev                                                       as source_revision,
        f.client_modified,
        f.server_modified,
        f.synced_at                                                 as last_synced_at,
        f.row_count                                                 as bronze_row_count,
        f.column_count                                              as bronze_column_count,
        f.table_name                                                as bronze_table,
        f.status                                                    as sync_status,
        f.error                                                     as sync_error,
        tg.gold_table,
        tg.gold_grain,
        gc.gold_row_count,
        case
            when f.row_count is null or gc.gold_row_count is null or f.row_count = 0
                then null
            else cast(gc.gold_row_count * 100.0 / f.row_count as float)
        end                                                         as gold_pct_of_bronze,
        current_timestamp()                                         as built_at
    from files f
    left join table_to_gold tg
        on upper(f.table_name) = tg.bronze_table
    left join gold_counts gc
        on tg.gold_table = gc.gold_table

)

select * from joined

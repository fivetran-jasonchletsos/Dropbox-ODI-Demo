{{ config(materialized='view') }}

-- One row per (state, closing_year) with the count of failed banks
-- and the most-recent failure event. Drives mart_state_risk.

with failures as (

    select *
    from {{ ref('stg_failed_banks') }}

),

by_state_year as (

    select
        state,
        closing_year,
        count(*)                                                    as failure_count,
        max(closing_date)                                           as most_recent_failure_date,
        listagg(distinct bank_name, '; ') within group (order by bank_name) as failed_bank_names
    from failures
    group by state, closing_year

)

select * from by_state_year

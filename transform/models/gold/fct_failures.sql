{{ config(materialized='table') }}

-- One row per failed-bank event with date dimensions, state name,
-- region, and a surrogate key for downstream joins.

with failures as (

    select *
    from {{ ref('stg_failed_banks') }}

),

states as (

    select *
    from {{ ref('state_fips') }}

),

joined as (

    select
        {{ dbt_utils.generate_surrogate_key(['cert', 'closing_date']) }} as failure_key,
        f.cert,
        f.bank_name,
        f.city,
        f.state                                                     as state_code,
        s.state_name,
        s.region,
        f.acquiring_institution,
        f.had_acquirer,
        f.closing_date,
        f.closing_year,
        f.closing_quarter,
        f.closing_month,
        f.fund,
        current_timestamp()                                         as built_at
    from failures f
    left join states s
        on f.state = s.state_code

)

select * from joined

{{ config(materialized='table') }}

-- Institution dimension. One row per cert with the full denormalized
-- view used by the Sentinel UI: institution master + branch footprint
-- + risk decomposition + state name + charter label.

with inst as (

    select *
    from {{ ref('stg_institutions') }}

),

branches as (

    select *
    from {{ ref('int_institution_branches') }}

),

risk as (

    select *
    from {{ ref('mart_institution_risk_score') }}

),

states as (

    select *
    from {{ ref('state_fips') }}

),

charters as (

    select *
    from {{ ref('charter_class_definitions') }}

),

joined as (

    select
        i.cert,
        i.name                                                      as institution_name,
        i.namehcr                                                   as holding_company,
        i.city                                                      as headquarters_city,
        i.state                                                     as headquarters_state,
        s.state_name                                                as headquarters_state_name,
        s.region                                                    as headquarters_region,
        i.zip                                                       as headquarters_zip,
        i.bkclass                                                   as charter_class,
        c.charter_label,
        c.regulator,
        i.charter_type,
        i.established_date,
        i.established_year,
        i.financials_as_of_date,
        i.total_assets_m,
        i.total_deposits_m,
        i.total_equity_m,
        i.net_income_m,
        i.capital_ratio_pct,
        i.roa_pct,
        i.roe_pct,
        i.asset_class,
        coalesce(b.branch_count, 1)                                 as branch_count,
        coalesce(b.total_branch_deposits_m, i.total_deposits_m)     as total_branch_deposits_m,
        coalesce(b.distinct_state_count, 1)                         as distinct_state_count,
        b.headquarters_state                                        as primary_branch_state,
        r.risk_score,
        r.risk_tier,
        r.capital_component,
        r.credit_component,
        r.earnings_component,
        r.peer_component,
        r.concentration_component,
        current_timestamp()                                         as built_at
    from inst i
    left join branches b
        on i.cert = b.cert
    left join risk r
        on i.cert = r.cert
    left join states s
        on i.state = s.state_code
    left join charters c
        on i.bkclass = c.charter_class

)

select * from joined

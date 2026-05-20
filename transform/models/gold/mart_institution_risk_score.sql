{{ config(materialized='table') }}

-- ============================================================
-- Sentinel institution risk score.
--
-- One row per cert with a 0-100 composite score and the full
-- decomposition so the UI can show "why this bank scored high."
--
-- Formula (documented in transform/README.md and the demo deck):
--
--   risk_score = round(
--       20 * (1 - least(capital_ratio_pct / 12, 1.0))           -- thin capital
--     + 25 * least(npl_ratio_pct / 5, 1.0)                       -- credit losses
--     + 20 * greatest(0, (1 - roa_pct / 1.0))                    -- weak earnings
--     + 20 * peer_5y_failure_rate_pct / 10.0                     -- state-cluster failure rate
--     + 15 * size_concentration_penalty                           -- charter-class + size
--   , 0)
--
-- Bucketing:
--   <25      low
--   25 - 49  watch
--   50 - 74  elevated
--   >= 75    high
--
-- npl_ratio_pct is approximated from negative net income because the
-- bronze CSV does not carry a non-performing-loans column. When real
-- FDIC NPL data arrives via Fivetran we swap this approximation for
-- the actual call-report field.
-- ============================================================

with institutions as (

    select
        cert,
        name,
        state,
        bkclass,
        total_assets_m,
        total_deposits_m,
        net_income_m,
        roa_pct,
        capital_ratio_pct,
        asset_class
    from {{ ref('stg_institutions') }}

),

-- Peer failure rate: failures in the same state over the last 5 years
-- divided by the count of institutions in that state today. Expressed
-- as a percentage so it plugs straight into the formula.
peer_failures_5y as (

    select
        state,
        sum(failure_count)                                          as failures_5y
    from {{ ref('int_state_failures') }}
    where closing_year >= year(current_date) - 5
    group by state

),

state_population as (

    select
        state,
        count(*)                                                    as institutions_in_state
    from institutions
    group by state

),

peer_rate as (

    select
        sp.state,
        sp.institutions_in_state,
        coalesce(pf.failures_5y, 0)                                 as failures_5y,
        case
            when sp.institutions_in_state > 0
                then coalesce(pf.failures_5y, 0) * 100.0 / sp.institutions_in_state
            else 0
        end                                                         as peer_5y_failure_rate_pct
    from state_population sp
    left join peer_failures_5y pf
        on sp.state = pf.state

),

-- Charter-class risk multiplier: savings institutions (SB / SA) and
-- non-member state commercials (NM) have historically failed at
-- higher rates than national OCC-supervised banks. These weights
-- come from the post-2008 failure-rate breakdown.
charter_multiplier as (

    select column1 as bkclass, column2 as charter_class_risk_multiplier
    from (values
        ('N',  0.85),
        ('NM', 1.05),
        ('SM', 0.90),
        ('SB', 1.20),
        ('SA', 1.30)
    ) v

),

components as (

    select
        i.cert,
        i.name,
        i.state,
        i.bkclass,
        i.total_assets_m,
        i.asset_class,
        coalesce(i.capital_ratio_pct, 8.0)                          as capital_ratio_pct,
        -- NPL approximation: when net income is negative, treat the
        -- loss as a proxy for NPL pressure; floor at zero.
        case
            when i.net_income_m < 0 and i.total_assets_m > 0
                then least(5.0, abs(i.net_income_m) / i.total_assets_m * 100.0 * 2.0)
            else 0.0
        end                                                         as npl_ratio_pct,
        coalesce(i.roa_pct, 1.0)                                    as roa_pct,
        coalesce(pr.peer_5y_failure_rate_pct, 0)                    as peer_5y_failure_rate_pct,
        coalesce(cm.charter_class_risk_multiplier, 1.0)             as charter_class_risk_multiplier,
        -- Size concentration penalty: very small banks (<$100M) and
        -- savings associations carry single-cluster concentration risk.
        case
            when i.total_assets_m < 100   then 1.0
            when i.total_assets_m < 1000  then 0.6
            when i.total_assets_m < 10000 then 0.3
            else                                0.1
        end
        * coalesce(cm.charter_class_risk_multiplier, 1.0)           as size_concentration_penalty
    from institutions i
    left join peer_rate pr
        on i.state = pr.state
    left join charter_multiplier cm
        on i.bkclass = cm.bkclass

),

scored as (

    select
        cert,
        name,
        state,
        bkclass,
        total_assets_m,
        asset_class,
        capital_ratio_pct,
        npl_ratio_pct,
        roa_pct,
        peer_5y_failure_rate_pct,
        charter_class_risk_multiplier,
        size_concentration_penalty,
        -- Component scores in raw units, before rounding.
        20.0 * (1.0 - least(capital_ratio_pct / 12.0, 1.0))         as capital_component,
        25.0 * least(npl_ratio_pct / 5.0, 1.0)                      as credit_component,
        20.0 * greatest(0.0, (1.0 - roa_pct / 1.0))                 as earnings_component,
        20.0 * least(peer_5y_failure_rate_pct / 10.0, 1.0)          as peer_component,
        15.0 * least(size_concentration_penalty, 1.0)               as concentration_component
    from components

),

assembled as (

    select
        *,
        round(
              capital_component
            + credit_component
            + earnings_component
            + peer_component
            + concentration_component
        , 0)                                                        as risk_score
    from scored

),

bucketed as (

    select
        cert,
        name,
        state,
        bkclass,
        total_assets_m,
        asset_class,
        capital_ratio_pct,
        npl_ratio_pct,
        roa_pct,
        peer_5y_failure_rate_pct,
        charter_class_risk_multiplier,
        size_concentration_penalty,
        capital_component,
        credit_component,
        earnings_component,
        peer_component,
        concentration_component,
        cast(risk_score as integer)                                 as risk_score,
        case
            when risk_score < 25 then 'low'
            when risk_score < 50 then 'watch'
            when risk_score < 75 then 'elevated'
            else                      'high'
        end                                                         as risk_tier,
        current_timestamp()                                         as built_at
    from assembled

)

select * from bucketed

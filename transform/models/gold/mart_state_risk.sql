{{ config(materialized='table') }}

-- State-level risk rollup. One row per state with deposit and branch
-- totals, institution counts, recent failure activity, and a 0-100
-- risk_index that blends failure rate and aggregate risk-score
-- distribution. Powers the heatmap on the Sentinel landing page.

with inst as (

    select *
    from {{ ref('dim_institution') }}

),

failures as (

    select *
    from {{ ref('fct_failures') }}
    where closing_year >= year(current_date) - 5

),

states as (

    select *
    from {{ ref('state_fips') }}

),

inst_rollup as (

    select
        headquarters_state                                          as state_code,
        count(*)                                                    as total_institutions,
        sum(total_branch_deposits_m)                                as total_deposits_m,
        sum(branch_count)                                           as total_branches,
        avg(risk_score)                                             as avg_risk_score,
        sum(case when risk_tier = 'high'     then 1 else 0 end)     as high_risk_count,
        sum(case when risk_tier = 'elevated' then 1 else 0 end)     as elevated_risk_count,
        avg(capital_ratio_pct)                                      as avg_capital_ratio_pct,
        avg(roa_pct)                                                as avg_roa_pct
    from inst
    where headquarters_state is not null
    group by headquarters_state

),

failure_rollup as (

    select
        state_code,
        count(*)                                                    as failed_count_5y,
        max(closing_date)                                           as most_recent_failure_date
    from failures
    group by state_code

),

assembled as (

    select
        s.state_code,
        s.state_name,
        s.region,
        coalesce(ir.total_institutions, 0)                          as total_institutions,
        coalesce(ir.total_deposits_m, 0)                            as total_deposits_m,
        coalesce(ir.total_deposits_m, 0) / 1000.0                   as total_deposits_b,
        coalesce(ir.total_branches, 0)                              as total_branches,
        coalesce(ir.avg_risk_score, 0)                              as avg_risk_score,
        coalesce(ir.high_risk_count, 0)                             as high_risk_count,
        coalesce(ir.elevated_risk_count, 0)                         as elevated_risk_count,
        ir.avg_capital_ratio_pct,
        ir.avg_roa_pct,
        coalesce(fr.failed_count_5y, 0)                             as failed_count_5y,
        fr.most_recent_failure_date,
        case
            when coalesce(ir.total_institutions, 0) > 0
                then coalesce(fr.failed_count_5y, 0) * 100.0 / ir.total_institutions
            else 0
        end                                                         as failure_rate_pct_5y
    from states s
    left join inst_rollup ir
        on s.state_code = ir.state_code
    left join failure_rollup fr
        on s.state_code = fr.state_code

),

scored as (

    select
        state_code,
        state_name,
        region,
        total_institutions,
        total_deposits_m,
        total_deposits_b,
        total_branches,
        avg_risk_score,
        high_risk_count,
        elevated_risk_count,
        avg_capital_ratio_pct,
        avg_roa_pct,
        failed_count_5y,
        most_recent_failure_date,
        failure_rate_pct_5y,
        -- Composite state risk index, 0-100.
        --   60% weight on average institution risk score
        --   30% weight on the 5-year failure rate (capped at 20%)
        --   10% weight on the share of elevated/high institutions
        cast(round(
            least(100.0, greatest(0.0,
                  0.60 * coalesce(avg_risk_score, 0)
                + 0.30 * least(failure_rate_pct_5y * 5.0, 100.0)
                + 0.10 * case
                            when total_institutions > 0
                                then (high_risk_count + elevated_risk_count) * 100.0 / total_institutions
                            else 0
                         end
            ))
        , 1) as float)                                              as risk_index,
        current_timestamp()                                         as built_at
    from assembled

)

select * from scored

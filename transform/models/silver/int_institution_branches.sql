{{ config(materialized='view') }}

-- Roll up branches to the institution level for the most recent
-- available survey_year. Produces one row per cert with footprint
-- and aggregate deposit columns used by dim_institution.

with sod as (

    select *
    from {{ ref('stg_summary_of_deposits') }}

),

latest_year as (

    select max(survey_year) as max_year
    from sod

),

latest as (

    select s.*
    from sod s
    cross join latest_year y
    where s.survey_year = y.max_year

),

rolled as (

    select
        cert,
        any_value(survey_year)                                      as survey_year,
        count(*)                                                    as branch_count,
        sum(branch_deposits_m)                                      as total_branch_deposits_m,
        count(distinct branch_state)                                as distinct_state_count,
        count(distinct branch_zip)                                  as distinct_zip_count,
        max(case when is_main_office then branch_state end)         as headquarters_state,
        max(case when is_main_office then branch_city end)          as headquarters_city
    from latest
    group by cert

)

select * from rolled

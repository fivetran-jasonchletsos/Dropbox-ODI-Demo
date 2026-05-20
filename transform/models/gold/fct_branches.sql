{{ config(materialized='table') }}

-- One row per branch with location dimensions and a join back to the
-- parent institution. The branch-level fact powers map-style demos.

with sod as (

    select *
    from {{ ref('stg_summary_of_deposits') }}

),

inst as (

    select
        cert,
        name                                                        as institution_name,
        bkclass                                                     as institution_charter_class,
        asset_class                                                 as institution_asset_class,
        state                                                       as institution_hq_state
    from {{ ref('stg_institutions') }}

),

states as (

    select *
    from {{ ref('state_fips') }}

),

joined as (

    select
        {{ dbt_utils.generate_surrogate_key(['s.survey_year', 's.cert', 's.branch_id']) }} as branch_key,
        s.survey_year,
        s.cert,
        s.branch_id,
        s.branch_name,
        s.branch_address,
        s.branch_city,
        s.branch_state                                              as branch_state_code,
        st.state_name                                               as branch_state_name,
        st.region                                                   as branch_region,
        s.branch_zip,
        s.branch_deposits_m,
        s.is_main_office,
        i.institution_name,
        i.institution_charter_class,
        i.institution_asset_class,
        i.institution_hq_state,
        case
            when s.branch_state != i.institution_hq_state then true
            else false
        end                                                         as is_out_of_state_branch,
        current_timestamp()                                         as built_at
    from sod s
    left join inst i
        on s.cert = i.cert
    left join states st
        on s.branch_state = st.state_code

)

select * from joined

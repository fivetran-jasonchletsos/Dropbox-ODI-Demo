{{ config(materialized='view') }}

-- Conformed branch-level deposits. Cast types, convert $K to $M,
-- dedupe on (year, cert, uninumbr) keeping the last row deterministically.

with source as (

    select *
    from {{ ref('br_summary_of_deposits') }}

),

renamed as (

    select
        cast(year as integer)                                       as survey_year,
        cast(cert as integer)                                       as cert,
        trim(namefull)                                              as institution_name,
        trim(branname)                                              as branch_name,
        trim(address)                                               as branch_address,
        trim(city)                                                  as branch_city,
        upper(trim(stalp))                                          as branch_state,
        cast(zipbr as varchar)                                      as branch_zip,
        cast(depsumbr as float) / 1000.0                            as branch_deposits_m,
        upper(trim(bkclass))                                        as bkclass,
        case when upper(trim(bkmo)) = 'Y' then true else false end  as is_main_office,
        cast(uninumbr as integer)                                   as branch_id
    from source
    where uninumbr is not null

),

deduped as (

    select *
    from (
        select
            *,
            row_number() over (
                partition by survey_year, cert, branch_id
                order by branch_deposits_m desc nulls last
            )                                                       as rn
        from renamed
    )
    where rn = 1

)

select
    survey_year,
    cert,
    branch_id,
    institution_name,
    branch_name,
    branch_address,
    branch_city,
    branch_state,
    branch_zip,
    branch_deposits_m,
    bkclass,
    is_main_office
from deduped

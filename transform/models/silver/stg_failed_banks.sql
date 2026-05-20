{{ config(materialized='view') }}

-- Conformed failed-bank events. Cast types, parse closing_date,
-- normalize the state code. One row per (cert, closing_date) — the
-- cert can theoretically repeat for re-charters; we keep both rows
-- and let downstream pick the latest.

with source as (

    select *
    from {{ ref('br_failed_bank_list') }}

),

renamed as (

    select
        cast(cert as integer)                                       as cert,
        trim(bank_name)                                             as bank_name,
        trim(city)                                                  as city,
        upper(trim(state))                                          as state,
        trim(acquiring_institution)                                 as acquiring_institution,
        try_to_date(cast(closing_date as varchar), 'YYYY-MM-DD')    as closing_date,
        upper(trim(fund))                                           as fund
    from source
    where cert is not null

),

derived as (

    select
        cert,
        bank_name,
        city,
        state,
        acquiring_institution,
        closing_date,
        fund,
        year(closing_date)                                          as closing_year,
        quarter(closing_date)                                       as closing_quarter,
        month(closing_date)                                         as closing_month,
        case
            when acquiring_institution ilike 'self-liquidat%' then false
            else true
        end                                                         as had_acquirer
    from renamed
    where closing_date is not null

)

select * from derived

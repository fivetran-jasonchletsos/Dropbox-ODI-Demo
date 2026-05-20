{{ config(materialized='view') }}

-- Conformed FDIC institution master. Cast types, convert $K to $M,
-- derive asset class buckets, and pull a clean established_year.
-- One row per cert.

with source as (

    select *
    from {{ ref('br_institutions') }}

),

renamed as (

    select
        cast(cert as integer)                                       as cert,
        trim(name)                                                  as name,
        trim(namehcr)                                               as namehcr,
        trim(city)                                                  as city,
        upper(trim(stalp))                                          as state,
        cast(zip as varchar)                                        as zip,
        upper(trim(bkclass))                                        as bkclass,
        trim(charter_type)                                          as charter_type,
        try_to_date(cast(estymd as varchar), 'YYYY-MM-DD')          as established_date,
        try_to_date(cast(dateupdt as varchar), 'YYYY-MM-DD')        as financials_as_of_date,
        -- Convert from $ thousands to $ millions, two decimals.
        cast(asset  as float) / 1000.0                              as total_assets_m,
        cast(dep    as float) / 1000.0                              as total_deposits_m,
        cast(eq     as float) / 1000.0                              as total_equity_m,
        cast(netinc as float) / 1000.0                              as net_income_m,
        cast(roa    as float)                                       as roa_pct,
        cast(roe    as float)                                       as roe_pct,
        upper(trim(regagnt))                                        as regulator
    from source
    where cert is not null

),

derived as (

    select
        cert,
        name,
        namehcr,
        city,
        state,
        zip,
        bkclass,
        charter_type,
        established_date,
        year(established_date)                                      as established_year,
        financials_as_of_date,
        total_assets_m,
        total_deposits_m,
        total_equity_m,
        net_income_m,
        roa_pct,
        roe_pct,
        regulator,
        -- Asset class buckets in $M (1B = 1000M, 100B = 100_000M).
        case
            when total_assets_m < 100         then '<100M'
            when total_assets_m < 1000        then '100M-1B'
            when total_assets_m < 10000       then '1B-10B'
            when total_assets_m < 100000      then '10B-100B'
            else                                   '>100B'
        end                                                         as asset_class,
        -- Capital ratio (equity / assets), expressed as a percent.
        case
            when total_assets_m > 0 then total_equity_m / total_assets_m * 100.0
        end                                                         as capital_ratio_pct
    from renamed

)

select * from derived

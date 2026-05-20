{{ config(materialized='view') }}

-- Bronze pass-through over the FDIC Summary of Deposits.
-- Dev runs against the seed; prod points at the Fivetran-landed table.

with src as (

    {% if target.name == 'dev' %}
    select
        year,
        cert,
        namefull,
        branname,
        address,
        city,
        stalp,
        zipbr,
        depsumbr,
        bkclass,
        bkmo,
        uninumbr
    from {{ ref('fdic_summary_of_deposits') }}
    {% else %}
    select
        year,
        cert,
        namefull,
        branname,
        address,
        city,
        stalp,
        zipbr,
        depsumbr,
        bkclass,
        bkmo,
        uninumbr
    from {{ source('bronze', 'fdic_summary_of_deposits') }}
    {% endif %}

)

select * from src

{{ config(materialized='view') }}

-- Bronze pass-through over the FDIC institutions master file.
-- Dev runs against the seed; prod points at the Fivetran-landed table.

with src as (

    {% if target.name == 'dev' %}
    select
        cert,
        name,
        namehcr,
        city,
        stalp,
        zip,
        bkclass,
        charter_type,
        estymd,
        dateupdt,
        asset,
        dep,
        eq,
        netinc,
        roa,
        roe,
        regagnt
    from {{ ref('fdic_institutions') }}
    {% else %}
    select
        cert,
        name,
        namehcr,
        city,
        stalp,
        zip,
        bkclass,
        charter_type,
        estymd,
        dateupdt,
        asset,
        dep,
        eq,
        netinc,
        roa,
        roe,
        regagnt
    from {{ source('bronze', 'fdic_institutions') }}
    {% endif %}

)

select * from src

{{ config(materialized='view') }}

-- Bronze pass-through over the FDIC Failed Bank List.
-- Dev runs against the seed; prod points at the Fivetran-landed table.

with src as (

    {% if target.name == 'dev' %}
    select
        bank_name,
        city,
        state,
        cert,
        acquiring_institution,
        closing_date,
        fund
    from {{ ref('fdic_failed_bank_list') }}
    {% else %}
    select
        bank_name,
        city,
        state,
        cert,
        acquiring_institution,
        closing_date,
        fund
    from {{ source('bronze', 'fdic_failed_bank_list') }}
    {% endif %}

)

select * from src

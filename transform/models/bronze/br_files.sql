{{ config(materialized='view') }}

-- Pass-through over Fivetran's _FILES metadata table — the ODI
-- provenance anchor that lets gold rows trace back to source files.
-- Dev runs against the `_files` seed; prod points at the Fivetran-
-- landed table.

with src as (

    {% if target.name == 'dev' %}
    select
        path,
        name,
        extension,
        size_bytes,
        rev,
        client_modified,
        server_modified,
        row_count,
        column_count,
        sheet_count,
        table_name,
        status,
        error,
        synced_at
    from {{ ref('_files') }}
    {% else %}
    select
        path,
        name,
        extension,
        size_bytes,
        rev,
        client_modified,
        server_modified,
        row_count,
        column_count,
        sheet_count,
        table_name,
        status,
        error,
        synced_at
    from {{ source('bronze', '_files') }}
    {% endif %}

)

select * from src

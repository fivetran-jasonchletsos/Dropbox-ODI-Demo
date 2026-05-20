{{ config(materialized='table', schema='gold') }}

-- MetricFlow daily time spine — required by the dbt semantic layer.
-- Covers 2000-01-01 through 2035-12-31 so every fact table has a
-- safe join target for time-based metrics.

{% set start_date = "2000-01-01" %}
{% set end_date   = "2035-12-31" %}

with spine as (

    select
        dateadd(day, seq4(), to_date('{{ start_date }}'))               as date_day
    from table(generator(rowcount => 13150))   -- ~36 years of days

)

select date_day
from spine
where date_day <= to_date('{{ end_date }}')

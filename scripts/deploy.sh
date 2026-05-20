#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "==> [1/3] Snowflake setup"
snowsql -f "$ROOT/infra/snowflake_setup.sql"

echo "==> [2/3] Fivetran connector deploy"
cd "$ROOT/connectors/dropbox"
fivetran deploy --connection dropbox_odi_demo

echo "==> [3/3] dbt build"
cd "$ROOT/transform"
dbt deps
dbt build
echo "Done."

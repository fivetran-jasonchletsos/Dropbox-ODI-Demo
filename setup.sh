#!/usr/bin/env bash
set -euo pipefail

# One-shot setup for Dropbox-ODI-Demo.
# Creates two Python envs (the connector deps conflict with dbt's pathspec pin)
# and installs both.

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

echo "==> Top-level env (dbt + scripts)"
python -m venv .venv
# shellcheck disable=SC1091
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
deactivate

echo "==> Connector env (Fivetran Connector SDK)"
python -m venv connectors/dropbox/.venv
# shellcheck disable=SC1091
source connectors/dropbox/.venv/bin/activate
pip install --upgrade pip
pip install -r connectors/dropbox/requirements.txt
deactivate

echo
echo "Done. Next steps:"
echo "  1. cp connectors/dropbox/configuration.example.json connectors/dropbox/configuration.json"
echo "  2. Edit configuration.json with your Dropbox auth"
echo "  3. snowsql -f infra/snowflake_setup.sql  (or run in Snowsight)"
echo "  4. python scripts/inspect_dropbox.py '<shared-link>'  to preview files"

#!/usr/bin/env bash
set -euo pipefail

# Launch dev stack (db + api + web) via docker-compose.
# Tests are not run here; use scripts/test-compose.sh.
# Requires Docker/Compose available on host.

PROJECT_NAME="scan2serve-dev"

docker compose --project-name "$PROJECT_NAME" up --build

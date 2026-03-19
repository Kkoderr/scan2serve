#!/usr/bin/env bash
set -euo pipefail

# Launch dev stack (db + api + web) via docker-compose.
# Requires Docker/Compose available on host.

docker compose up --build

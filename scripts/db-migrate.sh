#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

ensure_docker() {
  if ! command -v docker &>/dev/null; then
    echo "[❌] Docker is not installed. Install Docker Desktop or Docker Engine before proceeding." >&2
    exit 1
  fi

  if docker info >/dev/null 2>&1; then
    return
  fi

  echo "[ℹ️] Docker daemon not running. Attempting to start it..."
  case "$(uname -s)" in
    Darwin)
      if command -v open &>/dev/null; then
        open --background -a Docker || true
        echo "[ℹ️] Waiting for Docker Desktop to start..."
      fi
      ;;
    Linux)
      if command -v systemctl &>/dev/null; then
        sudo systemctl start docker || true
      fi
      ;;
  esac

  SECONDS_WAITED=0
  until docker info >/dev/null 2>&1; do
    sleep 2
    SECONDS_WAITED=$((SECONDS_WAITED + 2))
    if (( SECONDS_WAITED >= 120 )); then
      echo "[❌] Docker daemon did not become ready within 2 minutes. Start Docker manually and retry." >&2
      exit 1
    fi
  done
}

ensure_compose() {
  if command -v docker compose &>/dev/null; then
    echo "docker compose"
    return
  fi
  if command -v docker-compose &>/dev/null; then
    echo "docker-compose"
    return
  fi
  echo "[❌] docker compose is not available. Install a recent Docker version." >&2
  exit 1
}

start_services() {
  local compose_cmd
  compose_cmd="$(ensure_compose)"
  local services=(postgres redis minio)
  # LiveKit and y-websocket are optional for migrations but start if defined
  $compose_cmd config --services >/tmp/kouru-services.txt
  while read -r svc; do
    if [[ "$svc" == livekit || "$svc" == yws ]]; then
      services+=("$svc")
    fi
  done < /tmp/kouru-services.txt
  rm -f /tmp/kouru-services.txt

  echo "[ℹ️] Ensuring docker compose services are up: ${services[*]}"
  $compose_cmd up -d "${services[@]}"
}

resolve_host_database_url() {
  node <<'NODE'
const fs = require('fs');
const path = require('path');

let url = process.env.DATABASE_URL;
if (!url) {
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      if (!line || line.trimStart().startsWith('#')) continue;
      const idx = line.indexOf('=');
      if (idx === -1) continue;
      const key = line.slice(0, idx).trim();
      if (key !== 'DATABASE_URL') continue;
      let value = line.slice(idx + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      url = value;
      break;
    }
  }
}

if (!url) {
  process.exit(0);
}

try {
  const parsed = new URL(url);
  if (parsed.hostname === 'postgres') {
    parsed.hostname = 'localhost';
    console.log(parsed.toString());
  }
} catch {
  // If parsing fails, fall back to raw value.
  if (url.includes('postgres')) {
    console.log(url.replace('postgres', 'localhost'));
  }
}
NODE
}

run_typeorm() {
  local command="$1"
  local host_db_url
  host_db_url="$(resolve_host_database_url)"
  if [[ -n "$host_db_url" ]]; then
    export DATABASE_URL="$host_db_url"
  fi
  TS_NODE_PROJECT="$REPO_ROOT/apps/api/tsconfig.app.json" yarn typeorm "$command" -d apps/api/typeorm.config.ts
}

case "${1:-run}" in
  run)
    ensure_docker
    start_services
    echo "[ℹ️] Running TypeORM migrations"
    run_typeorm migration:run
    echo "[✅] Database is up to date."
    ;;
  revert)
    ensure_docker
    start_services
    echo "[ℹ️] Reverting last TypeORM migration"
    run_typeorm migration:revert
    echo "[✅] Latest migration reverted."
    ;;
  status)
    ensure_docker
    start_services
    echo "[ℹ️] Listing executed migrations"
    run_typeorm migration:show
    ;;
  *)
    echo "Usage: scripts/db-migrate.sh [run|revert|status]" >&2
    exit 1
    ;;
esac

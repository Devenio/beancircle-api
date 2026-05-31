#!/usr/bin/env bash
# Run the full Bean Circle stack locally: Docker infra, API, and Next.js front.
#
# Usage:
#   ./scripts/dev-local.sh           # start (assumes deps installed, DB migrated)
#   ./scripts/dev-local.sh --setup   # first-time: env files, npm install, migrate, seed
#
# Requires: Node >= 20.11 (nvm), Docker, sibling ../beancircle-front repo

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
FRONT_DIR="$(cd "$API_DIR/../beancircle-front" && pwd)"

SETUP=false
SEED=false

usage() {
  cat <<'EOF'
Bean Circle local dev

  ./scripts/dev-local.sh [--setup] [--seed]

Options:
  --setup   Copy .env files, npm install in api + front, migrate, and seed
  --seed    Run prisma db seed (implies nothing else unless combined with --setup)
  -h, --help

Services:
  PostgreSQL  localhost:5433
  Redis       localhost:6379
  MinIO       localhost:9000 (console :9001)
  API         http://localhost:3001/api/v1
  Front       http://localhost:3000/fa
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --setup) SETUP=true; SEED=true; shift ;;
    --seed) SEED=true; shift ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

log() {
  printf '[dev-local] %s\n' "$*"
}

load_nvm() {
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  if [[ -s "$NVM_DIR/nvm.sh" ]]; then
    # shellcheck disable=SC1090
    . "$NVM_DIR/nvm.sh"
    if [[ -f "$API_DIR/.nvmrc" ]]; then
      nvm use "$(tr -d '[:space:]' <"$API_DIR/.nvmrc")" >/dev/null
    else
      nvm use node >/dev/null
    fi
  else
    log "warning: nvm not found — using $(command -v node) ($(node -v 2>/dev/null || echo unknown))"
  fi
}

require_node() {
  if ! command -v node >/dev/null 2>&1; then
    log "error: node not found. Install Node 22 LTS or run: source ~/.nvm/nvm.sh && nvm install 22 && nvm use"
    exit 1
  fi
  local version major
  version="$(node -v | sed 's/^v//')"
  major="$(echo "$version" | cut -d. -f1)"
  if [[ "$major" -eq 23 ]]; then
    log "error: Node 23 is unsupported (Jest/npm engine mismatch). Run: nvm install 22 && nvm use"
    exit 1
  fi
  if [[ "$major" -lt 20 ]]; then
    log "error: Node >= 20.11 required (current v$version). Run: source ~/.nvm/nvm.sh && nvm use"
    exit 1
  fi
}

ensure_env_files() {
  if [[ ! -f "$API_DIR/.env" ]]; then
    cp "$API_DIR/.env.example" "$API_DIR/.env"
    log "created api/.env from .env.example"
  fi
  if [[ ! -f "$FRONT_DIR/.env.local" ]]; then
    cp "$FRONT_DIR/.env.local.example" "$FRONT_DIR/.env.local"
    log "created front/.env.local from .env.local.example"
  fi
}

start_infra() {
  if ! command -v docker >/dev/null 2>&1; then
    log "error: docker not found"
    exit 1
  fi
  log "starting Docker (postgres, redis, minio)..."
  (cd "$API_DIR" && docker compose up -d postgres redis minio)

  log "waiting for PostgreSQL..."
  local attempt=0
  until (cd "$API_DIR" && docker compose exec -T postgres pg_isready -U beancircle -d beancircle >/dev/null 2>&1); do
    attempt=$((attempt + 1))
    if [[ "$attempt" -gt 60 ]]; then
      log "error: PostgreSQL did not become ready within 60s"
      exit 1
    fi
    sleep 1
  done
  log "PostgreSQL is ready"
}

prepare_api() {
  cd "$API_DIR"
  if [[ "$SETUP" == true ]] || [[ ! -d node_modules ]]; then
    log "npm install (api)..."
    npm install
  fi
  log "prisma generate + migrate deploy..."
  npx prisma generate
  npx prisma migrate deploy
  if [[ "$SEED" == true ]]; then
    log "seeding database..."
    npx prisma db seed
  fi
}

prepare_front() {
  cd "$FRONT_DIR"
  if [[ "$SETUP" == true ]] || [[ ! -d node_modules ]]; then
    log "npm install (front)..."
    npm install
  fi
}

PIDS=()

cleanup() {
  local pid
  log "stopping dev servers..."
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null || true
}

trap cleanup EXIT INT TERM

if [[ ! -d "$FRONT_DIR" ]]; then
  log "error: frontend not found at $FRONT_DIR (expected sibling of beancircle-api)"
  exit 1
fi

load_nvm
require_node
ensure_env_files
start_infra
prepare_api
prepare_front

log "API  → http://localhost:3001/api/v1"
log "App  → http://localhost:3000/fa"
log "Ctrl+C to stop both servers"
echo

(cd "$API_DIR" && npm run start:dev 2>&1 | sed 's/^/[api]    /') &
PIDS+=($!)

(cd "$FRONT_DIR" && npm run dev 2>&1 | sed 's/^/[front]  /') &
PIDS+=($!)

wait -n || true
log "a dev server exited — stopping the other"
exit 1

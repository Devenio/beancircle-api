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
  PostgreSQL  localhost:5434
  Redis       localhost:6379
  MinIO       localhost:9000 (console :9001)
  API         http://localhost:3001/api/v1
  Front       http://localhost:3000/en
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

# npm on /mnt/c (WSL + Windows NTFS) breaks native modules (bcrypt ENOTDIR).
is_windows_mount_path() {
  [[ "$1" == /mnt/?/* ]]
}

maybe_delegate_to_windows() {
  if [[ -n "${BEANCIRCLE_FORCE_WSL:-}" ]]; then
    return 0
  fi
  if ! is_windows_mount_path "$API_DIR"; then
    return 0
  fi
  if ! command -v powershell.exe >/dev/null 2>&1 && ! command -v pwsh.exe >/dev/null 2>&1; then
    log "error: repo is on Windows drive ($API_DIR) but PowerShell was not found."
    log "Run from Windows: npm run dev:local:win:setup"
    log "Or clone under WSL home (~/beancircle-api), not /mnt/c."
    exit 1
  fi
  local ps1 win_args=() pshell=powershell.exe
  if ! command -v powershell.exe >/dev/null 2>&1; then
    pshell=pwsh.exe
  fi
  ps1="$(wslpath -w "$SCRIPT_DIR/dev-local.ps1")"
  log "Windows mount detected — using PowerShell (NTFS-safe npm/pnpm)..."
  [[ "$SETUP" == true ]] && win_args+=(-Setup)
  [[ "$SEED" == true && "$SETUP" != true ]] && win_args+=(-Seed)
  exec "$pshell" -NoProfile -ExecutionPolicy Bypass -File "$ps1" "${win_args[@]}"
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

sync_database_url_port() {
  local env_file="$API_DIR/.env"
  [[ -f "$env_file" ]] || return 0
  if grep -qE ':5433/' "$env_file" 2>/dev/null; then
    log "updating DATABASE_URL port 5433 -> 5434 (docker-compose publishes postgres on 5434; 5433 is often local PostgreSQL on Windows)"
    sed -i.bak -E 's/:5433\//:5434\//g' "$env_file"
    rm -f "${env_file}.bak"
  fi
}

ensure_env_files() {
  if [[ ! -f "$API_DIR/.env" ]]; then
    cp "$API_DIR/.env.example" "$API_DIR/.env"
    log "created api/.env from .env.example"
  fi
  sync_database_url_port
  if [[ ! -f "$FRONT_DIR/.env.local" ]]; then
    if [[ -f "$FRONT_DIR/.env.local.example" ]]; then
      cp "$FRONT_DIR/.env.local.example" "$FRONT_DIR/.env.local"
      log "created front/.env.local from .env.local.example"
    else
      cat >"$FRONT_DIR/.env.local" <<'EOF'
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
NEXT_PUBLIC_WS_URL=http://localhost:3001
EOF
      log "created front/.env.local (defaults; add .env.local.example to the front repo)"
    fi
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
    if [[ "$SETUP" == true ]] && [[ -d node_modules ]]; then
      log "removing api/node_modules (clean setup)..."
      rm -rf node_modules
    fi
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
    if [[ "$SETUP" == true ]] && [[ -d node_modules ]]; then
      log "removing front/node_modules (clean setup)..."
      rm -rf node_modules
    fi
    log "pnpm install (front)..."
    corepack enable 2>/dev/null || true
    if command -v pnpm >/dev/null 2>&1; then
      pnpm install
    else
      log "warning: pnpm not found — falling back to npm install"
      npm install
    fi
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

maybe_delegate_to_windows

load_nvm
require_node
ensure_env_files
start_infra
prepare_api
prepare_front

log "API  → http://localhost:3001/api/v1"
log "App  → http://localhost:3000/en"
log "Ctrl+C to stop both servers"
echo

(cd "$API_DIR" && npm run start:dev 2>&1 | sed 's/^/[api]    /') &
PIDS+=($!)

(
  cd "$FRONT_DIR"
  corepack enable 2>/dev/null || true
  if command -v pnpm >/dev/null 2>&1; then
    pnpm run dev
  else
    npm run dev
  fi
) 2>&1 | sed 's/^/[front]  /' &
PIDS+=($!)

wait -n || true
log "a dev server exited — stopping the other"
exit 1

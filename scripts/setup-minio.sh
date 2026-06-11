#!/usr/bin/env bash
# Create the beancircle bucket, public read policy, and browser CORS for local MinIO.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BUCKET="${R2_BUCKET:-beancircle}"

MINIO_ENDPOINT="${MINIO_ENDPOINT:-http://host.docker.internal:9000}"
MINIO_USER="${MINIO_ROOT_USER:-minioadmin}"
MINIO_PASS="${MINIO_ROOT_PASSWORD:-minioadmin}"

log() {
  printf '[setup-minio] %s\n' "$*"
}

if ! command -v docker >/dev/null 2>&1; then
  log "error: docker not found"
  exit 1
fi

log "waiting for MinIO at $MINIO_ENDPOINT..."
# Bucket CORS for browser PUT is handled by MINIO_API_CORS_ALLOW_ORIGIN on the minio service.
docker run --rm --entrypoint /bin/sh \
  --add-host=host.docker.internal:host-gateway \
  minio/mc -c "
    set -e
    until mc alias set local $MINIO_ENDPOINT $MINIO_USER $MINIO_PASS 2>/dev/null; do sleep 1; done
    mc mb local/$BUCKET --ignore-existing
    mc anonymous set download local/$BUCKET
    mc ls local
  "

log "MinIO bucket '$BUCKET' is ready (public read + CORS for local dev)"

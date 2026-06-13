# Create the beancircle bucket, public read policy, and browser CORS for local MinIO.
param(
    [string]$Bucket = 'beancircle',
    [string]$Endpoint = 'http://host.docker.internal:9000',
    [string]$User = 'minioadmin',
    [string]$Password = 'minioadmin'
)

$ErrorActionPreference = 'Stop'

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw 'Docker not found. Start Docker Desktop and retry.'
}

Write-Host "[setup-minio] waiting for MinIO at $Endpoint..."

# Bucket CORS for browser PUT is handled by MINIO_API_CORS_ALLOW_ORIGIN on the minio service.
$script = "until mc alias set local $Endpoint $User $Password 2>/dev/null; do sleep 1; done; mc mb local/$Bucket --ignore-existing; mc anonymous set download local/$Bucket; mc ls local"

docker run --rm --entrypoint /bin/sh `
    --add-host=host.docker.internal:host-gateway `
    minio/mc -c $script

if ($LASTEXITCODE -ne 0) { throw 'MinIO setup failed' }

Write-Host "[setup-minio] MinIO bucket '$Bucket' is ready (public read + CORS for local dev)"

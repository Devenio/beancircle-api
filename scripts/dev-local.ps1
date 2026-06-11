# Bean Circle local dev (Windows / WSL-on-NTFS safe).
# Use when the repo lives on C: (including /mnt/c/... from WSL).
#
#   npm run dev:local:win:setup   # first time
#   npm run dev:local:win         # later runs
#
# WSL users on /mnt/c are auto-delegated here from dev-local.sh.

param(
    [switch]$Setup,
    [switch]$Seed
)

$ErrorActionPreference = 'Stop'

if ($Setup) { $Seed = $true }

$ApiDir = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$FrontDir = Join-Path (Split-Path $ApiDir -Parent) 'beancircle-front'

function Write-DevLog([string]$Message) {
    Write-Host "[dev-local] $Message"
}

# Native tools (npx/npm) write warnings to stderr; PS 5.1 treats that as fatal when
# ErrorActionPreference is Stop. Only fail on exit code.
function Invoke-External {
    param(
        [Parameter(Mandatory)][string]$Label,
        [Parameter(Mandatory)][scriptblock]$Command
    )
    $prev = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $output = & $Command 2>&1
        $code = $LASTEXITCODE
        foreach ($line in $output) {
            if ($line -is [System.Management.Automation.ErrorRecord]) {
                Write-Host $line.ToString()
            }
            else {
                Write-Host $line
            }
        }
        if ($code -ne 0) {
            throw "$Label failed (exit $code)"
        }
    }
    finally {
        $ErrorActionPreference = $prev
    }
}

function Test-NodeVersion {
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        throw 'Node.js not found. Install Node 20+ or 24 LTS (avoid Node 23).'
    }
    $version = (node -v) -replace '^v', ''
    $major = [int]($version.Split('.')[0])
    if ($major -eq 23) {
        throw 'Node 23 is unsupported. Use Node 22 or 24 LTS.'
    }
    if ($major -lt 20) {
        throw "Node >= 20.11 required (current v$version)."
    }
}

function Sync-DatabaseUrlPort {
    $apiEnv = Join-Path $ApiDir '.env'
    if (-not (Test-Path $apiEnv)) { return }
    $content = Get-Content $apiEnv -Raw
    if ($content -match ':5433/') {
        Write-DevLog 'updating DATABASE_URL port 5433 -> 5434 (docker postgres; 5433 is often local PostgreSQL on Windows)'
        ($content -replace ':5433/', ':5434/') | Set-Content $apiEnv -NoNewline
    }
}

function Ensure-EnvFiles {
    $apiEnv = Join-Path $ApiDir '.env'
    if (-not (Test-Path $apiEnv)) {
        Copy-Item (Join-Path $ApiDir '.env.example') $apiEnv
        Write-DevLog 'created api/.env from .env.example'
    }
    if ($Setup) {
        Sync-DatabaseUrlPort
    }

    $frontEnv = Join-Path $FrontDir '.env.local'
    if (-not (Test-Path $frontEnv)) {
        $example = Join-Path $FrontDir '.env.local.example'
        if (Test-Path $example) {
            Copy-Item $example $frontEnv
            Write-DevLog 'created front/.env.local from .env.local.example'
        }
        else {
            @(
                'NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1'
                'NEXT_PUBLIC_WS_URL=http://localhost:3001'
            ) | Set-Content -Path $frontEnv -Encoding utf8
            Write-DevLog 'created front/.env.local (defaults)'
        }
    }
}

function Get-ApiPort {
    $port = 3001
    $apiEnv = Join-Path $ApiDir '.env'
    if (Test-Path $apiEnv) {
        $line = Select-String -Path $apiEnv -Pattern '^\s*PORT\s*=' | Select-Object -Last 1
        if ($line) {
            $value = ($line.Line -split '=', 2)[1].Trim().Trim('"').Trim("'")
            if ($value -match '^\d+$') { $port = [int]$value }
        }
    }
    return $port
}

function Stop-PortListener {
    param([int]$Port)
    $seen = @{}
    $connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    foreach ($conn in $connections) {
        $procId = $conn.OwningProcess
        if (-not $procId -or $procId -eq $PID -or $seen.ContainsKey($procId)) { continue }
        $seen[$procId] = $true
        Write-DevLog "stopping existing listener on port $Port (pid $procId)"
        Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
    }
    if ($seen.Count -gt 0) { Start-Sleep -Seconds 1 }
}

function Invoke-PrismaGenerate {
    $maxAttempts = 3
    $prev = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        for ($attempt = 1; $attempt -le $maxAttempts; $attempt++) {
            $lines = & npx prisma generate 2>&1
            $output = ($lines | ForEach-Object {
                if ($_ -is [System.Management.Automation.ErrorRecord]) { $_.ToString() } else { "$_" }
            }) -join "`n"
            foreach ($line in $lines) {
                if ($line -is [System.Management.Automation.ErrorRecord]) { Write-Host $line.ToString() }
                else { Write-Host $line }
            }
            if ($LASTEXITCODE -eq 0) { return }
            if ($attempt -lt $maxAttempts -and $output -match 'EPERM|operation not permitted') {
                Write-DevLog "prisma generate locked (attempt $($attempt)/$($maxAttempts)) - stopping dev servers and retrying..."
                Stop-PortListener (Get-ApiPort)
                Stop-PortListener 3000
                Start-Sleep -Seconds 2
                continue
            }
            if ($output) { Write-Host $output }
            throw 'prisma generate failed'
        }
    }
    finally {
        $ErrorActionPreference = $prev
    }
}

function Start-Infra {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        throw 'Docker not found. Start Docker Desktop and retry.'
    }
    Write-DevLog 'starting Docker (postgres, redis, minio)...'
    Push-Location $ApiDir
    try {
        docker compose up -d postgres redis minio | Out-Host
        Write-DevLog 'waiting for PostgreSQL...'
        $attempt = 0
        do {
            $attempt++
            $ready = $false
            try {
                docker compose exec -T postgres pg_isready -U beancircle -d beancircle 2>$null | Out-Null
                if ($LASTEXITCODE -eq 0) { $ready = $true }
            }
            catch { }
            if (-not $ready) {
                if ($attempt -gt 60) { throw 'PostgreSQL did not become ready within 60s' }
                Start-Sleep -Seconds 1
            }
        } until ($ready)
        Write-DevLog 'PostgreSQL is ready'
        Write-DevLog 'configuring MinIO (bucket + CORS)...'
        & (Join-Path $PSScriptRoot 'setup-minio.ps1')
    }
    finally {
        Pop-Location
    }
}

function Install-ApiDeps {
    Push-Location $ApiDir
    try {
        if ($Setup -or -not (Test-Path 'node_modules')) {
            if ($Setup -and (Test-Path 'node_modules')) {
                Write-DevLog 'removing api/node_modules (clean setup)...'
                Remove-Item -Recurse -Force node_modules
            }
            Write-DevLog 'npm install (api)...'
            Invoke-External 'npm install (api)' { npm install }
        }
        Write-DevLog 'prisma generate + migrate deploy...'
        Invoke-PrismaGenerate
        Invoke-External 'prisma migrate deploy' { npx prisma migrate deploy }
        if ($Seed) {
            Write-DevLog 'seeding database...'
            Invoke-External 'prisma db seed' { npx prisma db seed }
        }
    }
    finally {
        Pop-Location
    }
}

function Install-FrontDeps {
    if (-not (Test-Path $FrontDir)) {
        throw "frontend not found at $FrontDir (expected sibling of beancircle-api)"
    }
    Push-Location $FrontDir
    try {
        if ($Setup -or -not (Test-Path 'node_modules')) {
            if ($Setup -and (Test-Path 'node_modules')) {
                Write-DevLog 'removing front/node_modules (clean setup)...'
                Remove-Item -Recurse -Force node_modules
            }
            Write-DevLog 'pnpm install (front)...'
            Invoke-External 'pnpm install (front)' { corepack enable 2>$null; pnpm install }
        }
    }
    finally {
        Pop-Location
    }
}

function Start-DevServers {
    $apiPort = Get-ApiPort
    Write-DevLog "API  -> http://localhost:${apiPort}/api/v1"
    Write-DevLog 'App  -> http://localhost:3000/en'
    Write-DevLog 'Ctrl+C to stop both servers'
    Write-Host ''

    corepack enable 2>$null | Out-Null

    $api = Start-Process -FilePath 'npm.cmd' -ArgumentList 'run', 'start:dev' `
        -WorkingDirectory $ApiDir -PassThru -NoNewWindow
    $front = Start-Process -FilePath 'pnpm.cmd' -ArgumentList 'run', 'dev' `
        -WorkingDirectory $FrontDir -PassThru -NoNewWindow

    try {
        Wait-Process -Id $api.Id, $front.Id
    }
    catch {
        Write-DevLog 'a dev server exited - stopping the other'
    }
    finally {
        Write-DevLog 'stopping dev servers...'
        foreach ($proc in @($api, $front)) {
            if ($proc -and -not $proc.HasExited) {
                Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
            }
        }
    }
}

Test-NodeVersion
Ensure-EnvFiles
$script:ApiPort = Get-ApiPort
Stop-PortListener $script:ApiPort
Stop-PortListener 3000
Start-Infra
Install-ApiDeps
Install-FrontDeps
Start-DevServers

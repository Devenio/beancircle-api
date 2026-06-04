# Bean Circle API

NestJS backend for the Cafe Community MVP.

## Stack

- NestJS 11, Prisma, PostgreSQL, Redis, Socket.IO
- JWT auth (OTP mock + Google OAuth)
- S3-compatible uploads (MinIO locally, Cloudflare R2 in production)

## Requirements

- **Node.js 22 LTS** (or 20 / 24+). Use [nvm](https://github.com/nvm-sh/nvm): `nvm use` reads `.nvmrc`. Avoid Node 23 — Jest 30 does not support it.
- If `npx prisma migrate deploy` fails with `Unexpected token '??='`, your shell is on Node 14/16 — run `nvm use` in this directory first.

## Quick start

**One command (API + front + Docker):**

```bash
nvm use
chmod +x scripts/dev-local.sh   # once
npm run dev:local:setup         # first time (env, install, migrate, seed)
npm run dev:local               # later runs
```

App: `http://localhost:3000/fa` · API: `http://localhost:3001/api/v1`

### WSL with repo on `C:` (`/mnt/c/...`)

`npm install` on `/mnt/c` often fails for native modules (`bcrypt`, `ENOTDIR`). The bash script auto-runs the Windows PowerShell path instead (requires **Node 20+ on Windows PATH**, not only WSL nvm). You can also run explicitly:

```powershell
# From PowerShell in beancircle-api
npm run dev:local:win:setup
npm run dev:local:win
```

Or from WSL (same as `dev:local:setup` — delegates automatically):

```bash
npm run dev:local:setup
```

To force WSL npm anyway (not recommended on `/mnt/c`): `BEANCIRCLE_FORCE_WSL=1 npm run dev:local:setup`

Docker Postgres is published on **host port 5434** (not 5433) so it does not clash with a local PostgreSQL installation on Windows, which often already uses 5433.

**Manual setup:**

```bash
nvm use
cp .env.example .env
docker compose up -d postgres redis
npm install
npx prisma migrate dev
npx prisma db seed
npm run start:dev
```

API: `http://localhost:3001/api/v1`

## Smoke test

With the API running:

```bash
chmod +x scripts/smoke-test.sh
./scripts/smoke-test.sh
```

## Seed data

- Country: Iran
- Cities: Fardis, Karaj, Tehran
- Users: `admin` (ADMIN), `nima` (demo)
- Sample cafes in Fardis

OTP in mock mode: request OTP, use code returned in response (also `123456`).

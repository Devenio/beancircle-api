# Bean Circle API

NestJS backend for the Cafe Community MVP.

## Stack

- NestJS 11, Prisma, PostgreSQL, Redis, Socket.IO
- JWT auth (OTP mock + Google OAuth)
- S3-compatible uploads (MinIO locally, Cloudflare R2 in production)

## Quick start

```bash
# Node 20+ recommended
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

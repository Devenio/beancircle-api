FROM node:24-bookworm-slim AS base
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-lock.yaml .npmrc* ./
RUN pnpm install --frozen-lockfile --config.onlyBuiltDependencies[]=prisma --config.onlyBuiltDependencies[]=@prisma/client --config.onlyBuiltDependencies[]=bcrypt --config.onlyBuiltDependencies[]=@nestjs/core

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" pnpm prisma generate && pnpm run build

FROM base AS runner
ENV NODE_ENV=production
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/prisma ./prisma
# Drop-in menu template files (imported/assigned from the admin panel).
COPY --from=build /app/menu-templates ./menu-templates
EXPOSE 3001
CMD ["sh", "-c", "pnpm prisma migrate deploy && node dist/main.js"]

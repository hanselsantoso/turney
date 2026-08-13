# Turney API — build from repo root:
#   docker build -f apps/api/Dockerfile -t turney-api .
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile --filter @turney/api --filter @turney/shared

FROM deps AS run
COPY packages/shared packages/shared
COPY apps/api apps/api
WORKDIR /repo/apps/api
ENV NODE_ENV=production
EXPOSE 3001
# migrations run on boot, then the server starts
CMD ["sh", "-c", "pnpm exec drizzle-kit migrate && pnpm exec tsx src/server.ts"]

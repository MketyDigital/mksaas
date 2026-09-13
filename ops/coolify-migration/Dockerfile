FROM node:22-bookworm-slim

RUN corepack enable
WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .

CMD ["bash", "-lc", "set -euo pipefail; pnpm db:migrate; pnpm db:migrate:mkety-content; pnpm db:seed:mkety-content; pnpm db:smoke:mkety-content; echo MKETY_PRODUCTION_DB_MIGRATION_OK; sleep 600"]

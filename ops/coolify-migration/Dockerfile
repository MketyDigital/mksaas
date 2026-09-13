FROM node:22-bookworm-slim

RUN corepack enable
WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .

CMD ["bash", "-lc", "set +e; pnpm db:migrate && pnpm db:migrate:mkety-content && pnpm db:seed:mkety-content && pnpm db:smoke:mkety-content; status=$?; if [ \"$status\" -eq 0 ]; then echo MKETY_PRODUCTION_DB_MIGRATION_OK; else echo MKETY_PRODUCTION_DB_MIGRATION_FAILED:$status; fi; sleep 600; exit $status"]

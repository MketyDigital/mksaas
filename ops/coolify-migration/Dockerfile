FROM node:22-bookworm-slim

RUN corepack enable
WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN chmod +x /app/ops/coolify-migration/run.sh

EXPOSE 3000
CMD ["/app/ops/coolify-migration/run.sh"]

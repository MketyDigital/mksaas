FROM node:22-bookworm-slim

RUN corepack enable
WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN chmod +x /app/ops/coolify-migration/run.sh

EXPOSE 3000
HEALTHCHECK --interval=5s --timeout=3s --start-period=10s --retries=12 CMD node -e "const req=require('http').get('http://127.0.0.1:3000/',res=>process.exit(res.statusCode===200?0:1));req.on('error',()=>process.exit(1));req.setTimeout(2000,()=>{req.destroy();process.exit(1)})"
CMD ["/app/ops/coolify-migration/run.sh"]

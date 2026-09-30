FROM node:22-bookworm-slim

WORKDIR /app
COPY ops/coolify-migration/package.json ./package.json
RUN npm install --omit=dev --no-audit --no-fund
COPY ops/mail-gateway-acceptance/run.mjs ./run.mjs

USER node
EXPOSE 3000
HEALTHCHECK --interval=5s --timeout=3s --start-period=10s --retries=12 CMD node -e "const req=require('http').get('http://127.0.0.1:3000/',res=>process.exit(res.statusCode===200?0:1));req.on('error',()=>process.exit(1));req.setTimeout(2000,()=>{req.destroy();process.exit(1)})"
CMD ["node", "/app/run.mjs"]

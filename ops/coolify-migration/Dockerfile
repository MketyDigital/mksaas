FROM node:22-bookworm-slim

WORKDIR /migration
COPY ops/coolify-migration/package.json ./package.json
RUN npm install --omit=dev --no-audit --no-fund

WORKDIR /app
COPY . .
RUN ln -s /migration/node_modules /app/node_modules \
  && chmod +x /app/ops/coolify-migration/run.sh
ENV PATH="/migration/node_modules/.bin:${PATH}"

EXPOSE 3000
HEALTHCHECK --interval=5s --timeout=3s --start-period=10s --retries=12 CMD node -e "const req=require('http').get('http://127.0.0.1:3000/',res=>process.exit(res.statusCode===200?0:1));req.on('error',()=>process.exit(1));req.setTimeout(2000,()=>{req.destroy();process.exit(1)})"
CMD ["/app/ops/coolify-migration/run.sh"]

FROM node:22-alpine
WORKDIR /app
COPY ops/domainnameapi-relay/package.json ./package.json
COPY ops/domainnameapi-relay/server.mjs ./server.mjs
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=6 CMD node -e "const r=require('http').get('http://127.0.0.1:3000/health',x=>process.exit(x.statusCode===200?0:1));r.on('error',()=>process.exit(1));r.setTimeout(2000,()=>{r.destroy();process.exit(1)})"
CMD ["node","server.mjs"]

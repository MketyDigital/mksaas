FROM node:22-alpine
WORKDIR /app
COPY ops/mail-gateway/gateway.mjs /app/gateway.mjs
ENV NODE_ENV=production
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD node -e "require('http').get('http://127.0.0.1:8080/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"
EXPOSE 8080 993 465
USER node
CMD ["node","/app/gateway.mjs"]

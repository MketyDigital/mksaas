FROM node:22-alpine
WORKDIR /app
COPY ops/mail-gateway/gateway.mjs /app/gateway.mjs
ENV NODE_ENV=production
EXPOSE 8080 993 465
USER node
CMD ["node","/app/gateway.mjs"]

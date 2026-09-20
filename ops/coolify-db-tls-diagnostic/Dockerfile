FROM node:22-bookworm-slim
RUN apt-get update \
  && apt-get install -y --no-install-recommends postgresql-client openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY ops/coolify-db-tls-diagnostic/run.sh /app/run.sh
RUN chmod +x /app/run.sh
EXPOSE 3000
HEALTHCHECK --interval=5s --timeout=3s --start-period=5s --retries=20 CMD node -e "const r=require('http').get('http://127.0.0.1:3000/',x=>process.exit(x.statusCode===200?0:1));r.on('error',()=>process.exit(1));r.setTimeout(2000,()=>{r.destroy();process.exit(1)})"
CMD ["/app/run.sh"]

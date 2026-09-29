FROM caddy:2.10.2-alpine AS caddy

FROM ghcr.io/zitadel/zitadel-login:v4.17.1

USER root
COPY --from=caddy /usr/bin/caddy /usr/bin/caddy
COPY ops/zitadel-login/Caddyfile /app/Caddyfile
USER nextjs

HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=6 CMD node -e "const r=require('http').get('http://127.0.0.1:3000/',x=>process.exit(x.statusCode>=200&&x.statusCode<500?0:1));r.on('error',()=>process.exit(1));r.setTimeout(2000,()=>{r.destroy();process.exit(1)})"

ENTRYPOINT ["/bin/sh", "-c"]
CMD ["/app/entrypoint.sh node apps/login/server.js & exec /usr/bin/caddy run --config /app/Caddyfile --adapter caddyfile"]

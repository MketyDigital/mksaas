FROM caddy:2.10.2-alpine AS caddy

FROM ghcr.io/zitadel/zitadel-login:v4.17.1

USER root
COPY --from=caddy /usr/bin/caddy /usr/bin/caddy
COPY ops/zitadel-login/Caddyfile /app/Caddyfile
USER nextjs

ENTRYPOINT ["/bin/sh", "-c"]
CMD ["/app/entrypoint.sh node apps/login/server.js & exec /usr/bin/caddy run --config /app/Caddyfile --adapter caddyfile"]

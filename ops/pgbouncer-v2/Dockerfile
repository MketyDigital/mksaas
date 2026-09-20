FROM pgbouncer/pgbouncer:1.25.2-20260911

USER root
RUN apk add --no-cache openssl postgresql-client su-exec
COPY ops/pgbouncer-v2/entrypoint.sh /mkety-entrypoint.sh
RUN chmod 755 /mkety-entrypoint.sh

EXPOSE 6432
ENTRYPOINT ["/mkety-entrypoint.sh"]

FROM alpine:3.20

RUN apk add --no-cache bash ca-certificates redis aws-cli python3

COPY ops/redis-backup/run.sh /usr/local/bin/mkety-redis-backup
RUN chmod +x /usr/local/bin/mkety-redis-backup

ENTRYPOINT ["/usr/local/bin/mkety-redis-backup"]

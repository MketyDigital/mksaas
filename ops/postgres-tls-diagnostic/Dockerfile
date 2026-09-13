FROM alpine:3.20
RUN apk add --no-cache bash ca-certificates openssl postgresql16-client
COPY ops/postgres-tls-diagnostic/run.sh /usr/local/bin/run
RUN chmod +x /usr/local/bin/run
ENTRYPOINT ["/usr/local/bin/run"]

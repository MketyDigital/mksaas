FROM alpine:3.22
RUN apk add --no-cache openssl
WORKDIR /app
COPY ops/coolify-ca-mount-diagnostic/run.sh /app/run.sh
RUN chmod +x /app/run.sh
EXPOSE 3000
HEALTHCHECK --interval=5s --timeout=3s --start-period=3s --retries=12 CMD wget -q -O- http://127.0.0.1:3000/ >/dev/null || exit 1
CMD ["/app/run.sh"]

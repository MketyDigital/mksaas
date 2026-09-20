FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /diag
COPY ops/db-tls-diagnostic/run.sh /diag/run.sh
RUN chmod +x /diag/run.sh
EXPOSE 3000
CMD ["/diag/run.sh"]

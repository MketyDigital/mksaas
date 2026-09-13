#!/usr/bin/env bash
set -euo pipefail
: "${DATABASE_URL:?DATABASE_URL required}"
python3_not_needed=true
host="$(printf '%s' "$DATABASE_URL" | sed -E 's#^[a-zA-Z0-9+.-]+://([^@/]+@)?([^:/?]+).*#\2#')"
port="$(printf '%s' "$DATABASE_URL" | sed -nE 's#^[a-zA-Z0-9+.-]+://([^@/]+@)?[^:/?]+:([0-9]+).*#\2#p')"
[ -n "$port" ] || port=5432
printf 'MKETY_PG_TLS_DIAG=begin\n'
PGCONNECT_TIMEOUT=10 psql "${DATABASE_URL}${DATABASE_URL#*\?}" >/dev/null 2>&1 || true
ssl_url="$DATABASE_URL"
case "$ssl_url" in *\?*) ssl_url="${ssl_url}&sslmode=require" ;; *) ssl_url="${ssl_url}?sslmode=require" ;; esac
if PGCONNECT_TIMEOUT=10 psql "$ssl_url" -Atqc "select current_setting('ssl'), current_setting('ssl_min_protocol_version'), current_setting('ssl_max_protocol_version'), current_setting('ssl_ciphers');" >/tmp/pg-settings.txt 2>/tmp/pg-error.txt; then
  echo 'MKETY_PG_TLS_PSQL_REQUIRE_OK=true'
  sed 's/^/MKETY_PG_TLS_SETTINGS=/' /tmp/pg-settings.txt
else
  echo 'MKETY_PG_TLS_PSQL_REQUIRE_OK=false'
  sed -E 's#(postgres(ql)?://)[^ ]+#\1***#g' /tmp/pg-error.txt | head -20 | sed 's/^/MKETY_PG_TLS_PSQL_ERROR=/'
fi
set +e
openssl s_client -starttls postgres -connect "${host}:${port}" -servername "$host" -showcerts </dev/null >/tmp/ssl-out.txt 2>/tmp/ssl-err.txt
rc=$?
set -e
echo "MKETY_PG_TLS_OPENSSL_RC=$rc"
grep -E 'Protocol *:|Cipher *:|Verify return code:|subject=|issuer=|notBefore=|notAfter=' /tmp/ssl-out.txt | head -30 | sed 's/^/MKETY_PG_TLS_OPENSSL=/' || true
if grep -q -- '-----BEGIN CERTIFICATE-----' /tmp/ssl-out.txt; then
  awk '/-----BEGIN CERTIFICATE-----/{f=1} f{print} /-----END CERTIFICATE-----/{exit}' /tmp/ssl-out.txt >/tmp/server.crt
  openssl x509 -in /tmp/server.crt -noout -subject -issuer -dates -fingerprint -sha256 | sed 's/^/MKETY_PG_TLS_CERT=/'
fi
sed -E 's#(postgres(ql)?://)[^ ]+#\1***#g' /tmp/ssl-err.txt | head -20 | sed 's/^/MKETY_PG_TLS_OPENSSL_ERR=/' || true
echo 'MKETY_PG_TLS_DIAG=done'
while true; do sleep 3600; done

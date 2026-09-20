#!/bin/sh
set -eu

: "${DB_HOST:?DB_HOST is required}"
DB_PORT="${DB_PORT:-5432}"

tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT

echo "MKETY_DB_TLS_DIAG_STAGE=starttls"
set +e
timeout 15 openssl s_client -starttls postgres -connect "$DB_HOST:$DB_PORT" -servername "$DB_HOST" -showcerts -verify_return_error </dev/null >"$tmpdir/sclient.out" 2>"$tmpdir/sclient.err"
rc=$?
set -e

awk '/-----BEGIN CERTIFICATE-----/{p=1} p{print} /-----END CERTIFICATE-----/{exit}' "$tmpdir/sclient.out" > "$tmpdir/server.crt" || true

if [ -s "$tmpdir/server.crt" ]; then
  echo "MKETY_DB_TLS_DIAG_CERT_PRESENT=true"
  openssl x509 -in "$tmpdir/server.crt" -noout -subject -issuer -dates -fingerprint -sha256     | sed -E 's/(subject|issuer)=.*/\1=[safe certificate identity captured]/'
else
  echo "MKETY_DB_TLS_DIAG_CERT_PRESENT=false"
fi

verify_code="$(grep -Eo 'Verify return code: [0-9]+ \([^)]*\)' "$tmpdir/sclient.out" | tail -n1 || true)"
[ -n "$verify_code" ] && echo "MKETY_DB_TLS_DIAG_$verify_code"

if grep -qi 'self-signed certificate' "$tmpdir/sclient.err" "$tmpdir/sclient.out"; then
  echo "MKETY_DB_TLS_DIAG_CLASS=self-signed"
elif grep -qiE 'unable to get local issuer|unable to verify the first certificate|certificate verify failed' "$tmpdir/sclient.err" "$tmpdir/sclient.out"; then
  echo "MKETY_DB_TLS_DIAG_CLASS=untrusted-chain"
elif grep -qiE 'handshake failure|alert handshake failure|no peer certificate' "$tmpdir/sclient.err" "$tmpdir/sclient.out"; then
  echo "MKETY_DB_TLS_DIAG_CLASS=handshake"
elif [ "$rc" -eq 0 ]; then
  echo "MKETY_DB_TLS_DIAG_CLASS=verified"
else
  echo "MKETY_DB_TLS_DIAG_CLASS=other"
fi

echo "MKETY_DB_TLS_DIAG_OPENSSL_EXIT=$rc"
echo "MKETY_DB_TLS_DIAG_DONE=true"

exec node -e "require('http').createServer((req,res)=>{res.statusCode=200;res.end('ok')}).listen(3000,'0.0.0.0')"

#!/bin/sh
set -eu

: "${DATABASE_URL:?DATABASE_URL is required}"

echo "MKETY_TLS_DIAG_STAGE=sql"
psql "$DATABASE_URL" -Atqc "select 'server_version='||current_setting('server_version'); select 'ssl='||current_setting('ssl'); select 'ssl_min_protocol_version='||current_setting('ssl_min_protocol_version'); select 'ssl_max_protocol_version='||current_setting('ssl_max_protocol_version'); select 'ssl_ciphers='||current_setting('ssl_ciphers'); select 'ssl_prefer_server_ciphers='||current_setting('ssl_prefer_server_ciphers'); select 'ssl_cert_file='||current_setting('ssl_cert_file'); select 'ssl_key_file='||current_setting('ssl_key_file');"

host="$(node -e "const u=new URL(process.env.DATABASE_URL);process.stdout.write(u.hostname)")"
port="$(node -e "const u=new URL(process.env.DATABASE_URL);process.stdout.write(u.port||'5432')")"

echo "MKETY_TLS_DIAG_STAGE=openssl"
set +e
timeout 15 openssl s_client -starttls postgres -connect "$host:$port" -servername db-origin.mkety.com -tls1_2 </dev/null 2>/tmp/openssl.err >/tmp/openssl.out
code12=$?
set -e
echo "tls12_exit=$code12"
openssl x509 -in /tmp/openssl.out -noout -subject -issuer -serial -dates 2>/dev/null | sed -E 's/serial=.*/serial=[redacted]/' || true
grep -E 'Protocol *:|Cipher *:|Verify return code:' /tmp/openssl.out || true

set +e
timeout 15 openssl s_client -starttls postgres -connect "$host:$port" -servername db-origin.mkety.com -tls1_3 </dev/null 2>/tmp/openssl13.err >/tmp/openssl13.out
code13=$?
set -e
echo "tls13_exit=$code13"
grep -E 'Protocol *:|Cipher *:|Verify return code:' /tmp/openssl13.out || true

echo "MKETY_TLS_DIAG_OK=true"
exec node -e "require('http').createServer((req,res)=>{res.statusCode=200;res.setHeader('content-type','text/plain');res.end('ok')}).listen(3000,'0.0.0.0')"

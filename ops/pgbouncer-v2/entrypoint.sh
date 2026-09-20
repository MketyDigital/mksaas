#!/bin/sh
set -eu

required="DB_INTERNAL_HOST DB_INTERNAL_PORT DB_NAME DB_USER DB_PASSWORD DB_HOSTNAME ORIGIN_CERT_B64 ORIGIN_KEY_B64 ORIGIN_ROOT_B64"
for name in $required; do
  eval "value=\${$name:-}"
  [ -n "$value" ] || { echo "Missing required runtime value: $name" >&2; exit 10; }
done

mkdir -p /run/mkety
printf '%s' "$ORIGIN_CERT_B64" | base64 -d > /run/mkety/server.crt
printf '%s' "$ORIGIN_KEY_B64" | base64 -d > /run/mkety/server.key
printf '%s' "$ORIGIN_ROOT_B64" | base64 -d > /run/mkety/origin-root.pem

escaped_password="$(printf '%s' "$DB_PASSWORD" | sed 's/\\/\\\\/g; s/"/\\"/g')"
printf '"%s" "%s"\n' "$DB_USER" "$escaped_password" > /run/mkety/userlist.txt

cat > /run/mkety/pgbouncer.ini <<EOF
[databases]
$DB_NAME = host=$DB_INTERNAL_HOST port=$DB_INTERNAL_PORT dbname=$DB_NAME user=$DB_USER

[pgbouncer]
listen_addr = 0.0.0.0
listen_port = 6432
auth_type = scram-sha-256
auth_file = /run/mkety/userlist.txt
pool_mode = transaction
max_client_conn = 200
default_pool_size = 20
server_tls_sslmode = verify-ca
server_tls_ca_file = /etc/mkety/coolify-ca.crt
client_tls_sslmode = require
client_tls_cert_file = /run/mkety/server.crt
client_tls_key_file = /run/mkety/server.key
EOF

chmod 600 /run/mkety/server.key /run/mkety/userlist.txt /run/mkety/pgbouncer.ini
chmod 644 /run/mkety/server.crt /run/mkety/origin-root.pem
chown -R pgbouncer:pgbouncer /run/mkety 2>/dev/null || chown -R nobody:nobody /run/mkety

openssl verify -CAfile /run/mkety/origin-root.pem /run/mkety/server.crt >/dev/null
openssl x509 -in /run/mkety/server.crt -noout -checkhost "$DB_HOSTNAME" >/dev/null
echo MKETY_PGBOUNCER_V2_CLIENT_CERT_OK=true

PGPASSWORD="$DB_PASSWORD" psql "host=$DB_INTERNAL_HOST port=$DB_INTERNAL_PORT dbname=$DB_NAME user=$DB_USER sslmode=verify-ca sslrootcert=/etc/mkety/coolify-ca.crt connect_timeout=10" -v ON_ERROR_STOP=1 -Atqc 'SELECT 1' | grep -qx 1
echo MKETY_PGBOUNCER_V2_UPSTREAM_VERIFY_OK=true

su-exec pgbouncer /opt/pgbouncer/pgbouncer /run/mkety/pgbouncer.ini &
pid=$!

ready=no
for i in $(seq 1 30); do
  if openssl s_client -starttls postgres -connect 127.0.0.1:6432 -CAfile /run/mkety/origin-root.pem -verify_return_error -verify_hostname "$DB_HOSTNAME" </dev/null >/tmp/tls.txt 2>&1; then
    ready=yes
    break
  fi
  kill -0 "$pid" 2>/dev/null || { cat /tmp/tls.txt >&2 || true; exit 31; }
  sleep 1
done
[ "$ready" = yes ] || { cat /tmp/tls.txt >&2 || true; exit 32; }
grep -q 'Verify return code: 0 (ok)' /tmp/tls.txt
echo MKETY_PGBOUNCER_V2_CLIENT_TLS_OK=true

PGPASSWORD="$DB_PASSWORD" psql "host=$DB_HOSTNAME hostaddr=127.0.0.1 port=6432 dbname=$DB_NAME user=$DB_USER sslmode=verify-full sslrootcert=/run/mkety/origin-root.pem connect_timeout=10" -v ON_ERROR_STOP=1 -Atqc 'SELECT 1' | grep -qx 1
echo MKETY_PGBOUNCER_V2_QUERY_OK=true
echo MKETY_PGBOUNCER_V2_READY=true

wait "$pid"

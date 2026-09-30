#!/bin/sh
set -eu
# Check a real query through local PgBouncer with hostname-verified TLS.
# Keep credentials in the environment and never print them in probe output.
export PGPASSWORD="$DB_PASSWORD"
psql "host=$DB_HOSTNAME hostaddr=127.0.0.1 port=6432 dbname=$DB_NAME user=$DB_USER sslmode=verify-full sslrootcert=/run/mkety/origin-root.pem connect_timeout=10" -v ON_ERROR_STOP=1 -Atqc 'SELECT 1' | grep -qx 1

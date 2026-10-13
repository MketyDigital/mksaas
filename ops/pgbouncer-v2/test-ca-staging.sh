#!/bin/sh
set -eu

image="${1:?usage: test-ca-staging.sh IMAGE}"
test_dir="$(mktemp -d)"
trap 'rm -rf "$test_dir"' EXIT HUP INT TERM
source_ca="$test_dir/mounted-ca.crt"
printf 'test-ca-content\n' > "$source_ca"
chmod 600 "$source_ca"

docker run --rm --entrypoint /bin/sh \
  -v "$source_ca:/etc/mkety/coolify-ca.crt:ro" \
  "$image" -ec '
    mkdir -p /run/mkety
    /stage-upstream-ca.sh /etc/mkety/coolify-ca.crt /run/mkety/coolify-ca.crt
    test "$(stat -c "%a" /run/mkety/coolify-ca.crt)" = 644
    su-exec mkety sh -c '\''test "$(cat "$1")" = test-ca-content'\'' sh /run/mkety/coolify-ca.crt
  '
echo 'root-only mounted CA is readable by the unprivileged PgBouncer user'

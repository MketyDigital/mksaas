#!/bin/sh
set -eu
ca=/etc/ssl/certs/coolify-ca.crt
[ -f "$ca" ] || { echo MKETY_CA_MOUNT_PRESENT=false; exit 11; }
openssl x509 -in "$ca" -noout -subject -issuer -dates
echo MKETY_CA_MOUNT_PRESENT=true
exec busybox httpd -f -p 3000 -h /tmp

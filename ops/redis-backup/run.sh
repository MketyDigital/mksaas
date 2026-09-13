#!/usr/bin/env bash
set -euo pipefail

for variable in REDIS_URL R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY R2_S3_API R2_BUCKET; do
  if [ -z "${!variable:-}" ]; then
    echo "MKETY_REDIS_BACKUP_ERROR=missing-${variable}"
    exit 2
  fi
done

mkdir -p /tmp/mkety-redis-backup
snapshot="/tmp/mkety-redis-backup/dump.rdb"
rm -f "$snapshot"

echo 'MKETY_REDIS_BACKUP_STAGE=snapshot'
redis-cli --no-auth-warning -u "$REDIS_URL" --rdb "$snapshot" >/tmp/redis-rdb.log 2>&1 || {
  echo 'MKETY_REDIS_BACKUP_ERROR=snapshot-failed'
  exit 3
}

size="$(wc -c < "$snapshot" | tr -d ' ')"
if ! [[ "$size" =~ ^[0-9]+$ ]] || [ "$size" -le 0 ]; then
  echo 'MKETY_REDIS_BACKUP_ERROR=empty-snapshot'
  exit 4
fi
echo "MKETY_REDIS_BACKUP_SNAPSHOT_BYTES=$size"
echo 'MKETY_REDIS_BACKUP_STAGE_OK=snapshot'

export AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID"
export AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY"
export AWS_DEFAULT_REGION=auto
endpoint_origin="$(python3 - <<'PY'
import os
from urllib.parse import urlsplit
u=urlsplit(os.environ['R2_S3_API'])
print(f'{u.scheme}://{u.netloc}')
PY
)"

timestamp="$(date -u +'%Y/%m/%d/%Y%m%dT%H%M%SZ')"
key="redis/mkety-redis/${timestamp}.rdb"
echo 'MKETY_REDIS_BACKUP_STAGE=upload'
aws s3api put-object \
  --endpoint-url "$endpoint_origin" \
  --bucket "$R2_BUCKET" \
  --key "$key" \
  --body "$snapshot" \
  --content-type application/octet-stream \
  >/tmp/r2-put.json

echo 'MKETY_REDIS_BACKUP_STAGE_OK=upload'

echo 'MKETY_REDIS_BACKUP_STAGE=verify'
remote_size="$(aws s3api head-object \
  --endpoint-url "$endpoint_origin" \
  --bucket "$R2_BUCKET" \
  --key "$key" \
  --query ContentLength \
  --output text)"
if [ "$remote_size" != "$size" ]; then
  echo "MKETY_REDIS_BACKUP_ERROR=size-mismatch local=$size remote=$remote_size"
  exit 5
fi
echo "MKETY_REDIS_BACKUP_REMOTE_BYTES=$remote_size"
echo 'MKETY_REDIS_BACKUP_STAGE_OK=verify'
echo 'MKETY_REDIS_BACKUP_OK=true'

# Keep the ephemeral Coolify app alive long enough for the controller to verify markers.
while true; do sleep 3600; done

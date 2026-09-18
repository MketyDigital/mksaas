#!/bin/sh
set -eu

cd /app

run_stage() {
  stage="$1"
  shift
  echo "MKETY_DB_STAGE=$stage"
  "$@"
  echo "MKETY_DB_STAGE_OK=$stage"
}

run_stage base-migrate drizzle-kit migrate
run_stage content-migrate tsx scripts/migrate-mkety-platform-content.ts
run_stage content-seed tsx scripts/seed-mkety-platform-content.ts
run_stage billing-seed tsx scripts/seed-mkety-billing-catalog.ts
run_stage content-smoke tsx scripts/smoke-mkety-platform-content.ts
run_stage billing-smoke tsx scripts/smoke-mkety-billing-catalog.ts

echo 'MKETY_DB_RELEASE_SEQUENCE_OK=true'
exec node -e "require('http').createServer((req,res)=>{res.statusCode=200;res.setHeader('content-type','text/plain');res.end('ok')}).listen(3000,'0.0.0.0')"

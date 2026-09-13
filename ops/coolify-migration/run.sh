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

run_stage base-migrate pnpm dlx drizzle-kit@0.31.8 migrate
run_stage content-migrate pnpm dlx tsx@4.21.0 scripts/migrate-mkety-platform-content.ts
run_stage content-seed pnpm dlx tsx@4.21.0 scripts/seed-mkety-platform-content.ts
run_stage content-smoke pnpm dlx tsx@4.21.0 scripts/smoke-mkety-platform-content.ts

echo 'MKETY_DB_RELEASE_SEQUENCE_OK=true'
exec node -e "require('http').createServer((req,res)=>{res.statusCode=200;res.setHeader('content-type','text/plain');res.end('ok')}).listen(3000,'0.0.0.0')"

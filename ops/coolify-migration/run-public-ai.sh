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

run_stage public-ai-migrate drizzle-kit migrate
run_stage public-ai-routing-configure tsx scripts/configure-public-ai-production.ts

echo 'MKETY_DB_RELEASE_SEQUENCE_OK=true'
exec node -e "require('http').createServer((req,res)=>{res.statusCode=200;res.setHeader('content-type','text/plain');res.end('ok')}).listen(3000,'0.0.0.0')"

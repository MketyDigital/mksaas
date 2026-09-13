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

run_stage base-migrate pnpm db:migrate
run_stage content-migrate pnpm db:migrate:mkety-content
run_stage content-seed pnpm db:seed:mkety-content
run_stage content-smoke pnpm db:smoke:mkety-content

echo 'MKETY_DB_RELEASE_SEQUENCE_OK=true'
exec node -e "require('http').createServer((req,res)=>{res.statusCode=200;res.setHeader('content-type','text/plain');res.end('ok')}).listen(3000,'0.0.0.0')"

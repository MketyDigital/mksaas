#!/bin/sh
set -eu

cd /app
echo 'MKETY_DB_STAGE=public-ai-migrate'
drizzle-kit migrate
echo 'MKETY_DB_STAGE_OK=public-ai-migrate'
echo 'MKETY_DB_RELEASE_SEQUENCE_OK=true'
exec node -e "require('http').createServer((req,res)=>{res.statusCode=200;res.setHeader('content-type','text/plain');res.end('ok')}).listen(3000,'0.0.0.0')"

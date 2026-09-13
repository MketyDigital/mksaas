#!/bin/sh
set -eu

pnpm db:migrate
pnpm db:migrate:mkety-content
pnpm db:seed:mkety-content
pnpm db:smoke:mkety-content
pnpm db:migrate
pnpm db:migrate:mkety-content
pnpm db:seed:mkety-content

exec node -e "require('http').createServer((req,res)=>{res.statusCode=200;res.setHeader('content-type','text/plain');res.end('ok')}).listen(3000,'0.0.0.0')"

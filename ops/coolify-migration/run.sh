#!/bin/sh
set -eu

exec node -e "require('http').createServer((req,res)=>{res.statusCode=200;res.setHeader('content-type','text/plain');res.end('ok')}).listen(3000,'0.0.0.0')"

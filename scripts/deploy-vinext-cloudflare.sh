#!/usr/bin/env bash
set -euo pipefail

expected_worker_name="${CANDIDATE_WORKER_NAME:-}"
if [ -z "$expected_worker_name" ]; then
  expected_worker_name="$(node -e "const fs=require('node:fs'); const c=JSON.parse(fs.readFileSync('wrangler.jsonc','utf8')); process.stdout.write(c.name || '')")"
fi

if [ -z "$expected_worker_name" ]; then
  echo 'Could not determine the expected Cloudflare Worker name.' >&2
  exit 1
fi

server_config=''
while IFS= read -r config; do
  if node - "$config" "$expected_worker_name" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');
const [configPath, expectedName] = process.argv.slice(2);
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
if (config.name !== expectedName || typeof config.main !== 'string' || !config.main) process.exit(1);
const entry = path.resolve(path.dirname(configPath), config.main);
if (!fs.existsSync(entry)) process.exit(1);
NODE
  then
    if [ -n "$server_config" ]; then
      echo "Multiple generated server Worker configs matched $expected_worker_name." >&2
      exit 1
    fi
    server_config="$config"
  fi
done < <(find dist -mindepth 2 -maxdepth 2 -type f -name wrangler.json ! -path 'dist/client/*' | sort)

if [ -z "$server_config" ]; then
  echo "No generated server Worker config matched $expected_worker_name." >&2
  echo 'Generated Wrangler configs:' >&2
  find dist -mindepth 2 -maxdepth 2 -type f -name wrangler.json -print >&2 || true
  exit 1
fi

echo "Deploying generated server Worker config: $server_config"
exec pnpm exec wrangler deploy --config "$server_config" "$@"

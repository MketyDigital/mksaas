#!/usr/bin/env bash
set -euo pipefail

expected_worker_name="${CANDIDATE_WORKER_NAME:-}"
if [ -z "$expected_worker_name" ]; then
  expected_worker_name="$(node - <<'NODE'
const fs = require('node:fs');
const ts = require('typescript');
const file = 'wrangler.jsonc';
const parsed = ts.parseConfigFileTextToJson(file, fs.readFileSync(file, 'utf8'));
if (parsed.error) {
  const message = ts.flattenDiagnosticMessageText(parsed.error.messageText, '\n');
  throw new Error(`Unable to parse ${file}: ${message}`);
}
process.stdout.write(typeof parsed.config?.name === 'string' ? parsed.config.name : '');
NODE
)"
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

deploy_env=''
dry_run='false'
forward_args=()
while [ "$#" -gt 0 ]; do
  case "$1" in
    --env|-e)
      if [ "$#" -lt 2 ]; then
        echo "$1 requires an environment name." >&2
        exit 1
      fi
      deploy_env="$2"
      shift 2
      ;;
    --env=*)
      deploy_env="${1#--env=}"
      shift
      ;;
    --dry-run)
      dry_run='true'
      forward_args+=("$1")
      shift
      ;;
    *)
      forward_args+=("$1")
      shift
      ;;
  esac
done

# Framework-generated Wrangler configs are concrete deployment configs: named
# environments have already been flattened out. Re-applying `--env preview` to
# the generated config makes Wrangler append the preview suffix but cannot read
# env.preview settings such as workers_dev, which uploads a version with no
# workers.dev deployment target. Materialize the preview identity and target at
# the generated config's top level instead, then deploy the concrete artifact.
if [ "$deploy_env" = 'preview' ]; then
  node - "$server_config" "$expected_worker_name" <<'NODE'
const fs = require('node:fs');
const [configPath, baseWorkerName] = process.argv.slice(2);
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const previewWorkerName = `${baseWorkerName}-preview`;
config.name = previewWorkerName;
config.workers_dev = true;
config.preview_urls = true;
fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
console.log(`Materialized generated preview Worker config for ${previewWorkerName} with workers.dev enabled.`);
NODE
elif [ -n "$deploy_env" ]; then
  echo "Generated Worker config does not contain named environments; refusing to re-apply --env $deploy_env." >&2
  exit 1
fi

echo "Deploying generated server Worker config: $server_config"

# Dry-runs have no published target to wait for.
if [ "$dry_run" = 'true' ] || [ "$deploy_env" != 'preview' ]; then
  exec pnpm exec wrangler deploy --config "$server_config" "${forward_args[@]}"
fi

# A successful Wrangler upload can precede workers.dev edge propagation by a
# few seconds. The preview workflow performs strict route smokes immediately
# after this command, so wait until the deployed Worker route is actually
# reachable rather than allowing a transient Cloudflare 404 to fail the gate.
deploy_log="$(mktemp)"
trap 'rm -f "$deploy_log"' EXIT
set +e
pnpm exec wrangler deploy --config "$server_config" "${forward_args[@]}" 2>&1 | tee "$deploy_log"
deploy_status=${PIPESTATUS[0]}
set -e
if [ "$deploy_status" -ne 0 ]; then
  exit "$deploy_status"
fi

preview_url="$(grep -Eo 'https://[^[:space:]]+\.workers\.dev' "$deploy_log" | tail -n 1 || true)"
if [ -z "$preview_url" ]; then
  echo 'Wrangler deployed the preview Worker but did not report a workers.dev URL.' >&2
  exit 1
fi

for attempt in $(seq 1 15); do
  status="$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' --max-time 15 "$preview_url/api/health" || true)"
  if [ "$status" != '000' ] && [ "$status" != '404' ]; then
    echo "Preview Worker is reachable at $preview_url (health route HTTP $status; attempt $attempt)."
    exit 0
  fi
  echo "Preview Worker propagation pending at $preview_url (HTTP ${status:-000}; attempt $attempt/15)."
  sleep 2
done

echo "Preview Worker did not become reachable at $preview_url within the propagation window." >&2
exit 1

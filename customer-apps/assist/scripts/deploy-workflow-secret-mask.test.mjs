import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(new URL("../../../.github/workflows/mkety-assist-deploy.yml", import.meta.url), "utf8");
const secretStep = workflow.match(/- name: Normalize Telegram webhook secret([\s\S]*?)(?=\n      - name: )/);

test("Luna deployment preflight permits only a fully migrated idempotent retry", () => {
  assert.match(workflow,/solTargets<1 && \(solReferences!==0 \|\| existingLunaPrimaries<1\)/);
  assert.match(workflow,/expectedLunaPrimaries=solTargets\+existingLunaPrimaries/);
  assert.match(workflow,/EXPECTED_LUNA_PRIMARIES/);
  assert.match(workflow,/lunaPrimaries!==expected/);
});

test("derived Telegram webhook secret is rotated per run and masked before export", () => {
  assert.ok(secretStep, "Telegram webhook secret normalization step exists");
  const body = secretStep[1];
  assert.match(body, /printf '%s:%s:%s' "\$MKETY_ASSIST_TELEGRAM_AUTH_WEBHOOK_SECRET" "\$GITHUB_RUN_ID" "\$GITHUB_RUN_ATTEMPT"/);
  assert.match(body, /echo "::add-mask::\$safe_secret"/);
  assert.ok(body.indexOf("::add-mask::") < body.indexOf("GITHUB_ENV"), "mask is registered before the secret reaches later steps");
});

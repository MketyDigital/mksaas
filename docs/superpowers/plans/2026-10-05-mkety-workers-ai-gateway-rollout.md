# Mkety Workers AI Gateway Rollout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bind the main Mkety Worker to its AI Gateway for Workers AI routing and observability while keeping Workers AI on standard postpaid billing and keeping Enterprise production inference disabled.

**Architecture:** Resolve or create the named production gateway through the existing Cloudflare-authenticated deployment workflow, explicitly set and verify `workers_ai_billing_mode: "postpaid"`, and inject the gateway ID into the generated Worker config. Keep frontier providers on Mkety’s direct provider connections; do not configure Cloudflare Unified Billing or third-party frontier routing.

**Tech Stack:** GitHub Actions, Cloudflare API, Wrangler, Cloudflare Workers AI binding, Node.js config validation, existing production release workflow.

**Spec:** `docs/superpowers/specs/2026-10-05-mkety-central-ai-provider-runtime-design.md`

## Global Constraints

- Use the production Worker `mkety-platform` only after exact-SHA release checks in `.github/workflows/mkety-ai-production.yml`.
- Set Cloudflare gateway Workers AI billing to `postpaid` (standard Workers AI account billing), never `unified`.
- Do not use Cloudflare prepaid credits or Cloudflare-managed third-party frontier credentials.
- Do not switch on Enterprise managed inference as part of gateway binding.
- Never print Cloudflare tokens, API credentials, or customer prompts in workflow output.
- Keep `customer-apps/assist` completely untouched.

## Review Focus

- Gateway provisioning finds multiple similarly named gateways — test exact ID/name matching in Task 1.
- Existing gateway is configured for Unified billing — Task 1 must switch it to `postpaid` and verify the returned setting before deployment.
- Wrong Cloudflare account/token permissions — fail before changing the Worker in Task 1.
- Generated Wrangler config loses the gateway ID — assert the exact `MKETY_AI_GATEWAY_ID` var in Task 2.
- Gateway binding accidentally enables Enterprise customer inference — assert `customerInferenceEnabled` remains false in Task 3.

---

## File map

Modify:

- `.github/workflows/mkety-ai-production.yml`
- `.github/workflows/mkety-cloudflare-preview.yml`
- `scripts/deploy-vinext-cloudflare.sh` only if the deployment config assertion cannot be tested in the workflow
- `scripts/verify-cloudflare-deploy-candidate.ts` only if the current candidate gate needs a non-billable gateway-config check
- `src/features/ai-runtime/providers/runtime.cloudflare.ts` only if the binding contract or diagnostics need a clear standard-billing error
- relevant workflow/config contract tests

No provider secret or model route is changed by this rollout plan.

---

### Task 1: Provision and verify the gateway in standard billing mode

**Files:**
- Modify: `.github/workflows/mkety-ai-production.yml`
- Add: a script test for gateway API response parsing/idempotency if logic is extracted from YAML

**Interfaces:**
- Consumes: existing `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` repository secrets.
- Produces: environment-specific workflow outputs `preview_gateway_id` and `production_gateway_id`, resolved to exactly one named gateway in that Cloudflare account.

- [ ] **Step 1: Write failing tests** for absent preview/production gateways, one exact match, duplicate match, bad API response, and either gateway with `workers_ai_billing_mode: "unified"`.
- [ ] **Step 2: Run** the gateway config tests. Confirm missing/duplicate/unified cases fail.
- [ ] **Step 3: Implement** idempotent list/get/create/update logic for stable preview and production gateway IDs. Set each gateway’s `workers_ai_billing_mode: "postpaid"`; verify account identity and both returned settings before exposing the outputs.
- [ ] **Step 4: Run** the tests. Expected: each environment receives one gateway ID only after standard billing is confirmed; credentials and response secrets are never printed.
- [ ] **Step 5: Commit** as `ci: ensure mkety workers ai gateway uses standard billing`.

### Task 2: Inject gateway ID into the exact generated Worker config

**Files:**
- Modify: `.github/workflows/mkety-ai-production.yml`
- Modify: `scripts/deploy-vinext-cloudflare.sh` or add a config-contract test as needed.

- [ ] **Step 1: Write a failing config test** asserting the generated production config contains the `AI` binding and `vars.MKETY_AI_GATEWAY_ID` equal to `production_gateway_id`.
- [ ] **Step 2: Run** the config test. Confirm the current config does not contain the required gateway ID.
- [ ] **Step 3: Inject** the gateway ID into the generated config `vars` before build/deploy; do not store it as a secret if only the opaque gateway identifier is needed.
- [ ] **Step 4: Run** the config test and `pnpm run deploy --dry-run`. Expected: exactly one Gateway ID and the existing `AI` binding are preserved in the deployment artifact.
- [ ] **Step 5: Commit** as `ci: bind mkety platform worker to ai gateway`.

### Task 3: Bind and verify the non-production Worker

**Files:**
- Modify: `.github/workflows/mkety-cloudflare-preview.yml`
- Modify: preview config assertion test

- [ ] **Step 1: Write a failing config test** asserting preview uses only `preview_gateway_id` and that generated preview Worker config includes the `AI` binding.
- [ ] **Step 2: Run** the config test and confirm preview has no gateway ID.
- [ ] **Step 3: Inject** the preview gateway ID into the candidate/preview Worker config; keep it separate from production and keep its billing mode `postpaid`.
- [ ] **Step 4: Run** the candidate build/deploy dry run. Expected: the exact preview ID and Workers AI binding appear in the generated config without changing Enterprise inference settings.
- [ ] **Step 5: Commit** as `ci: bind mkety preview worker to standard ai gateway`.

### Task 4: Validate with a controlled Workers AI acceptance request

**Files:**
- Add or extend: non-production AI runtime smoke workflow and run evidence

- [ ] **Step 1: Add** a non-production smoke that calls one approved Workers AI model with a tiny fixed prompt, captures request ID/usage metadata, and reports only sanitized results.
- [ ] **Step 2: Run** the smoke in the candidate environment and verify Cloudflare account billing/usage records show standard Workers AI usage and no AI Gateway prepaid credit deduction.
- [ ] **Step 3: Verify** the request cannot select a third-party frontier provider through the gateway and does not alter Enterprise entitlement or `customerInferenceEnabled`.
- [ ] **Step 4: Commit** as `test: verify standard billing workers ai gateway route`.

### Task 5: Roll out the production binding with rollback evidence

- [ ] **Step 1: Re-read** current `.github/workflows/mkety-ai-production.yml`, Cloudflare Gateway state, production Worker state, and the exact candidate SHA after code verification.
- [ ] **Step 2: Confirm** the production gateway reports `postpaid`, the Worker `AI` binding exists, the generated config contains the exact production Gateway ID, and Enterprise managed inference is still disabled.
- [ ] **Step 3: Deploy** through the workflow’s existing verified-SHA and confirmation gates only; do not bypass its exact-SHA checks.
- [ ] **Step 4: Verify** deployed Worker config/diagnostics report the gateway binding and standard billing; verify no Unified Billing credits were loaded or used.
- [ ] **Step 5: Document** prior Worker configuration and the rollback command/workflow path before closing the rollout.

---

## Completion gate## Completion gate

Do not treat a configured gateway ID as proof of billing mode. Verify the gateway’s `workers_ai_billing_mode` value from Cloudflare before every production release using it. Cloudflare documents `postpaid` as standard account billing and `unified` as prepaid AI Gateway credits in the [gateway API](https://developers.cloudflare.com/api/resources/ai_gateway/methods/create/) and [Gateway management guide](https://developers.cloudflare.com/ai-gateway/configuration/manage-gateway/).

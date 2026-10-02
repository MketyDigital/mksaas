# Assist Owner Reasoning and Resilience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add business-owner-controlled reasoning tiers, safe model/media route operations, and audited reconciliation for uncertain paid inference while preserving live Assist behavior.

**Architecture:** Extend the assistant config, existing ordered model targets, current metering, and settlement journal. Add only an additive D1 migration, focused provider-reasoning and reconciliation modules, and UI/API extensions to existing Assist surfaces. Keep tenant reservations authoritative and fail closed on uncertain billing state.

**Tech Stack:** Cloudflare Workers, TypeScript, D1, Durable Objects, KV, Cloudflare Queues, Wrangler, Node test runner.

**Spec:** `docs/superpowers/specs/2026-10-02-assist-owner-reasoning-resilience-design.md`

## Global Constraints

- Scope changes to standalone Assist; do not import Main Mkety Platform application code or access its database.
- Every tenant-scoped operation is bound to authenticated `customer_id` and `assistant_id`.
- End users chatting with a business have no reasoning selector, MKredit account, or inference bill.
- Existing assistants default to `standard` and retain current complexity-aware reasoning behavior until their owner changes the setting.
- Preserve the explicit `high` or `maximum` selection by default; `reasoning_fallback_policy` defaults to `allow_lower_effort` for continuity, while `strict` requires the exact tier. Record requested/applied tiers and never lower effort without the owner's configured fallback policy.
- A cache or queue cannot authorize paid inference; verify current policy/rates and reservation before dispatch.
- Do not change existing tenant aliases, route ordering, prompts, context budgets, balances, or media feature policy during migration/deployment.
- Unknown or ambiguous provider outcomes must not be automatically retried, released, or charged at an invented amount.
- Preserve current prompt, knowledge, memory, image, voice, BYOK, reservation, and idempotent settlement paths.

## Review Focus

- Existing assistant rows after migration: assert the stored/default `standard` setting retains the existing complexity-based result.
- End-user request attempts to submit `reasoningMode` or `reasoning_effort`: assert they cannot override the authenticated owner's persisted setting.
- Ordered fallback with an unsupported selected tier: assert incompatible targets are skipped and no lower tier is silently sent.
- Alias pause, disabled media policy, and missing media provider: assert these states are distinct and no unrelated text route is disabled.
- Projection/DO/D1 failure around a provider submission: assert the reservation remains held and the same attempt is never submitted twice.

---

### Task 1: Persist and expose owner reasoning preference

**Files:**
- Modify: `customer-apps/assist/migrations/0036_assist_reasoning_reconciliation.sql` (create migration with the exact additive columns/tables below)
- Modify: `customer-apps/assist/src/runtime.ts:583-655` (tenant assistant GET/PATCH)
- Modify: `customer-apps/assist/src/assistants/service.ts` (version snapshot and rollback)
- Modify: `customer-apps/assist/src/ui.ts` (business owner's assistant editor)
- Test: `customer-apps/assist/scripts/assistant-reasoning.test.mjs`
- Test: `customer-apps/assist/scripts/check-security-isolation.mjs`

**Interfaces:**
- Produces persisted values `standard | high | maximum` on `assistants.reasoning_mode` and `allow_lower_effort | strict` on `assistants.reasoning_fallback_policy`.
- Adds to `model_route_targets`: nullable `reasoning_capabilities_json TEXT`, `reasoning_credits_per_million INTEGER`, and `provider_reasoning_cost_micros_per_million INTEGER`; `NULL` separate rates mean reasoning tokens use the existing output rates.
- Adds `inference_attempt_index(attempt_id PRIMARY KEY, customer_id, assistant_id, reservation_id, request_hash, provider, model, status, started_at, updated_at, input_units, output_units, reasoning_units, provider_cost_micros, resolved_at)` plus a customer/assistant/status/updated index.
- Adds `inference_attempt_resolution_audit(id PRIMARY KEY, attempt_id, idempotency_key UNIQUE, outcome, evidence_summary, reason, operator_user_id, created_at)`; store no prompt, response, credential, or raw provider payload.
- PATCH accepts `reasoningMode` only from the authenticated tenant admin, validates the enum, and stores it with the assistant version.
- GET returns the persisted mode and the supported modes for the assistant's resolved route; the owner UI disables unsupported tiers with an explanation.

- [ ] **Step 1: Write failing tests** named `testLegacyAssistantDefaultsToStandard` (assert legacy rows receive `standard` and keep adaptive effort), `testOwnerCanPersistSupportedReasoningMode` (authenticated owner PATCH then GET returns mode and fallback policy), `testInvalidReasoningModeIsRejected` (400 and no update), `testReasoningModeRoundTripsThroughVersionRollback` (snapshot and rollback restore both exact values), and `testEndUserCannotOverrideOwnerReasoningMode` (request-supplied effort/policy has no effect).
- [ ] **Step 2: Run** `node --experimental-strip-types --test scripts/assistant-reasoning.test.mjs` from `customer-apps/assist`; confirm failures for the new field/behavior.
- [ ] **Step 3: Add additive migration and persist the setting** in the authenticated owner assistant GET/PATCH and `recordAssistantVersion`/`rollbackAssistantVersion`; retain customer+assistant predicates and existing defaults.
- [ ] **Step 4: Add the owner-only selectors** to the existing assistant editor: Standard/High/Maximum and Allow lower effort if unavailable (default)/Require selected level. Explain that the fallback setting affects only provider capability availability. Do not add a chat/API end-user control.
- [ ] **Step 5: Re-run** `node --experimental-strip-types --test scripts/assistant-reasoning.test.mjs`; expect all five tests to pass.
- [ ] **Step 6: Apply migration locally and type-check** with `npm run db:migrate:local` and `npm run type-check` from `customer-apps/assist`.
- [ ] **Step 7: Commit** as `feat(assist): persist owner reasoning preference`.

### Task 2: Translate reasoning tiers and meter actual usage

**Files:**
- Create: `customer-apps/assist/src/providers/reasoning.ts` (provider/model capability lookup and effort translation)
- Modify: `customer-apps/assist/src/runtime.ts:1756,3186-3400,3599` (route dispatch, provider adapters, result usage extraction)
- Modify: `customer-apps/assist/src/index.ts:920-1110` (operator target capability and reasoning pricing fields)
- Modify: `customer-apps/assist/src/ui.ts:537-579` (target capability and rate editor)
- Modify: `customer-apps/assist/src/billing/metering.ts` (reasoning usage pricing)
- Test: `customer-apps/assist/scripts/provider-reasoning.test.mjs`
- Test: `customer-apps/assist/scripts/inference-settlement.test.mjs`
- Test: `customer-apps/assist/scripts/check-production-acceptance.mjs`

**Interfaces:**
- `reasoning.ts` exports `type ReasoningMode = "standard" | "high" | "maximum"`, `reasoningCapabilities(provider: string, model: string, configured: string[]): ReasoningMode[]`, and `providerReasoningOptions(provider: string, model: string, mode: ReasoningMode): Record<string, unknown> | null`.
- `standard` delegates to the current `selectReasoningEffort`; `high`/`maximum` translate only where the provider/model supports the effort. First try the selected tier across enabled compatible targets. If none is eligible, `allow_lower_effort` follows `maximum → high → standard` or `high → standard`; `strict` returns a clear owner configuration error. Never change tiers for an already ambiguous provider attempt.
- Provider result usage includes reasoning units when reported. Use the existing output rate when the provider bills those units as output; use an explicit target reasoning rate for providers with a separately billed reasoning class.

- [x] **Step 1: Write failing tests** named `testStandardPreservesAdaptiveEffort` (same current low/high outputs), `testHighAndMaximumTranslatePerProvider` (provider-specific option shape), `testStrictModeSkipsUnsupportedTargets` (no tier change), `testAllowLowerEffortUsesNextSupportedTier` (record requested/applied tiers), `testStrictNoEligibleTargetFailsClosed` (no provider request is made), and `testReasoningUnitsUseConfiguredRate` (separate rates when non-null, existing output rate otherwise).
- [x] **Step 2: Run** `node --experimental-strip-types --test scripts/provider-reasoning.test.mjs`; confirm the new mapping, skip, failure, and pricing assertions fail.
- [x] **Step 3: Implement the provider capability/translation module** and persist per-target supported tiers and separate reasoning prices only where configured. Reuse the current output rate for reasoning tokens that providers report as output tokens.
- [x] **Step 4: Pass the owner setting through the journaled inference path** and translate it separately for every fallback target. Do not read effort from untrusted inbound message parameters.
- [x] **Step 5: Include provider-reported reasoning usage in settlement** and preserve reservation estimates sufficient for configured maximum-tier usage; when the rate or usage cannot be safely determined, reject that tier before dispatch.
- [x] **Step 6: Re-run** `node --experimental-strip-types --test scripts/provider-reasoning.test.mjs scripts/inference-settlement.test.mjs` and `npm run check:production-acceptance`; expect all commands to pass.
- [x] **Step 7: Commit** as `feat(assist): honor and meter owner reasoning tiers`.

### Task 3: Add operator route pause and media readiness

**Files:**
- Modify: `customer-apps/assist/src/index.ts:920-1110` (existing `/api/ops/models` endpoints)
- Modify: `customer-apps/assist/src/runtime.ts:2316-2365,2814-2918,3164-3185` (eligibility, image and speech route diagnostics)
- Modify: `customer-apps/assist/src/ui.ts:537-585` (route state/readiness UI)
- Modify: `customer-apps/assist/scripts/check-operator-ui.mjs`
- Modify: `customer-apps/assist/scripts/check-production-acceptance.mjs`
- Test: `customer-apps/assist/scripts/model-route-readiness.test.mjs`

**Interfaces:**
- Operator GET reports per-alias status, enabled eligible target count, reasoning support, and readiness for `mkety-media-vision` and `mkety-media-speech`.
- Operator PATCH exposes existing alias `status` as pause/resume and existing per-target `enabled` as target pause/resume; route order and target identity do not change during status-only updates.
- Readiness distinguishes tenant feature policy disabled, alias intentionally paused, and enabled alias with no validated/priced target.

- [x] **Step 1: Write failing tests** named `testPausingTargetLeavesOrderedFallbackIntact` (only enabled state changes), `testPausingAliasIsExplicit` (alias status changes to paused), `testActiveAliasCannotAccidentallyLoseAllTargets` (active save is rejected), `testMediaPolicyDisabledDiffersFromRouteUnavailable` (distinct API states), and `testVisionAndSpeechReadinessUseValidatedPricedTargets` (separate readiness for validated and priced vision/speech targets).
- [x] **Step 2: Run** `node --experimental-strip-types --test scripts/model-route-readiness.test.mjs`; confirm failure for status visibility/readiness cases.
- [x] **Step 3: Extend the existing operator API/UI** to expose status and readiness without replacing aliases, reordering routes, or changing customer feature policy.
- [x] **Step 4: Preserve intentional whole-alias pause** while blocking accidental active-route saves with zero eligible targets; target pause must leave other ordered targets unchanged.
- [x] **Step 5: Add image and voice acceptance coverage** for primary dispatch, fallback dispatch, missing target, feature-policy disable, and independently settled usage.
- [x] **Step 6: Re-run** `node --experimental-strip-types --test scripts/model-route-readiness.test.mjs`, `npm run check:operator-ui`, and `npm run check:production-acceptance`; expect all to pass.
- [x] **Step 7: Commit** as `feat(assist): expose route pause and media readiness`.

### Task 4: Reconcile unknown provider outcomes safely

**Files:**
- Create: `customer-apps/assist/src/billing/reconciliation.ts` (projection, list, and idempotent resolution operations)
- Modify: `customer-apps/assist/src/billing/settlement-journal.ts` (safe attempt inspection/resolution RPC)
- Modify: `customer-apps/assist/src/runtime.ts:2460-2510,3070-3145` (write-ahead D1 projection and state transitions)
- Modify: `customer-apps/assist/src/index.ts` (operator-scoped list/resolve endpoints and scheduled stale-attempt reconciliation)
- Modify: `customer-apps/assist/src/ui.ts` (operator reconciliation view)
- Modify: `customer-apps/assist/wrangler.jsonc` only if new bindings are required; prefer existing D1, DO, and cron bindings
- Test: `customer-apps/assist/scripts/reconciliation.test.mjs`
- Test: `customer-apps/assist/scripts/settlement-journal.test.mjs`
- Test: `customer-apps/assist/scripts/check-security-isolation.mjs`

**Interfaces:**
- D1 projection row is keyed by immutable `attempt_id` and includes `customer_id`, `assistant_id`, `reservation_id`, provider/model, timestamps, status, reported usage/cost, and resolution key; it excludes prompt/response content and credentials.
- `listUnresolvedAttempts(db, limit, cursor)` returns only safe projection fields.
- `resolveUnknownAttempt(db, journal, input)` accepts scoped `attemptId`, one of `confirmed_not_submitted | recovered_result | provider_charged_no_result | unresolved`, provider-reported usage evidence/reason, and an idempotency key. `recovered_result` is allowed only when the journal contains the result; `provider_charged_no_result` settles only when exact billable usage is evidenced. A provider-cost figure without billable units remains unresolved unless an explicit internal cost-absorption action is recorded. It never performs a new provider inference call.
- Durable attempt status and D1 credit settlement remain idempotent; a D1 projection failure before provider dispatch blocks dispatch.

- [ ] **Step 1: Write failing tests** named `testDispatchRequiresDurableReconciliationIndex` (DB projection must exist before provider invocation), `testStaleAttemptListingIsTenantScoped` (another tenant's rows never appear), `testConfirmedNotSubmittedReleasesOnce` (one release and no redispatch during resolution), `testProviderChargedNoResultSettlesEvidencedUsage` (exact provider-reported usage is settled once), `testProviderCostWithoutUsageRemainsUnresolved` (no fabricated customer units), `testRecoveredResultSettlesAndDelivers` (use journaled response only), `testAmbiguousOutcomeRemainsHeld`, `testResolutionIsIdempotent`, and `testOperatorResolutionAuditOmitsPromptAndSecret`.
- [ ] **Step 2: Run** `node --experimental-strip-types --test scripts/reconciliation.test.mjs`; confirm required index, auth scope, idempotency, and hold behavior fail.
- [ ] **Step 3: Add the D1 projection and audit tables** in migration `0036`; persist an attempt index before any provider request can be dispatched and transition it idempotently with journal outcomes.
- [ ] **Step 4: Implement stale-attempt inspection and reconciliation APIs** using indexed assistant/attempt identities only; never enumerate Durable Object instances or invoke inference during repair.
- [ ] **Step 5: Implement audited resolution actions** with exact evidence, idempotency key, operator identity, tenant/assistant checks, and existing reservation/settlement primitives. Keep unknown charges held until evidenced; do not infer cost or automatically release.
- [ ] **Step 6: Add the operator UI** showing safe fields and explicit resolution choices; never render prompts, full user messages, credentials, or raw provider responses.
- [ ] **Step 7: Re-run** `node --experimental-strip-types --test scripts/reconciliation.test.mjs scripts/settlement-journal.test.mjs`, `npm run check:security-isolation`, and `npm run type-check`; expect all to pass.
- [ ] **Step 8: Commit** as `feat(assist): add audited inference reconciliation`.

### Task 5: Preserve outage, conversation, and release acceptance

**Files:**
- Modify: `customer-apps/assist/src/resilience.ts`, `customer-apps/assist/src/conversation/context-cache.ts`, and `customer-apps/assist/src/queues/inbound.ts` only where tests identify a missing bounded retry/recovery path
- Modify: `customer-apps/assist/scripts/check-conversation-quality.mjs`
- Modify: `customer-apps/assist/scripts/check-production-acceptance.mjs`
- Test: existing `context-cache.test.mjs`, `inbound-replay.test.mjs`, `conversation-quality.test.mjs`, `settlement-recovery.test.mjs`
- Verify: existing CI, Assist migration/deploy workflow, production health and controlled acceptance

**Interfaces:**
- Cache fallback is limited to documented version/TTL and non-authoritative reads; D1 rate/reservation failure still blocks paid dispatch.
- Retries are bounded and idempotent. An ambiguous submitted provider attempt remains held and cannot be regenerated under its attempt ID.

- [ ] **Step 1: Add failing outage/regression assertions** named `testCachedContextNeverAuthorizesInference`, `testReservationDatabaseFailurePreventsProviderCall`, `testTransientQueueRetryIsBounded`, and `testUnknownAttemptIsNeverReplayed`; keep the existing conversation-quality prompt/knowledge/memory cases green.
- [ ] **Step 2: Run the targeted tests** with `node --experimental-strip-types --test scripts/context-cache.test.mjs scripts/inbound-replay.test.mjs scripts/settlement-recovery.test.mjs scripts/conversation-quality.test.mjs`; record baseline failures for newly required behavior.
- [ ] **Step 3: Implement only the missing bounded recovery behavior** without changing cache keys/tenant scope, prompt assembly, existing queue delivery rules, or paid-dispatch billing gates.
- [ ] **Step 4: Run full Assist verification**: `npm run type-check`, `npm run check:all`, `npm run check:conversation-quality`, local migration application, and `npx wrangler deploy --dry-run` from `customer-apps/assist`; expect exit code 0 for each.
- [ ] **Step 5: Review the final diff against all nine spec acceptance criteria** and inspect the existing live aliases, active targets, media flags, and migration order; make no production route changes as part of rollout.
- [ ] **Step 6: Commit** as `test(assist): verify reasoning resilience and release gates`.
- [ ] **Step 7: Push the feature branch** and wait for exact-head Assist CI. Do not force-push. If the remote advanced, inspect and integrate its changes before retrying.
- [ ] **Step 8: Apply the additive migration and deploy Assist** through the repository's guarded production workflow, not by editing main-app deployment configuration.
- [ ] **Step 9: Verify deployed SHA, route/media health, text/image/voice acceptance, reasoning tier translation, owner MKredit settlement, fallback, unknown-outcome reconciliation, and existing live assistant behavior.** If any gate fails, stop rollout and use the documented runtime rollback while retaining additive migration and audit history.
- [ ] **Step 10: Report exact commit/SHA, CI evidence, migration/deploy evidence, and each live acceptance result.**

# Assist Inference Settlement Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Ensure every billable Assist provider attempt is recorded and charged once, including when the Worker, delivery path, or D1 settlement temporarily fails.

**Architecture:** Keep D1 as the canonical credit and usage ledger, and add a Durable Object settlement journal scoped by customer and assistant. Persist each provider attempt result before delivery, then apply it to D1 with an idempotency key; queue retries resume the recorded attempt instead of paying for generation again.

**Tech Stack:** TypeScript, Cloudflare Workers, Durable Objects, D1, Queues, Wrangler, Node 22 built-in test runner.

**Spec:** customer-apps/assist/docs/superpowers/specs/2026-10-02-assist-conversation-context-resilience-design.md

## Global Constraints

- Scope is the independently deployed Mkety Assist application under customer-apps/assist.
- Paid inference must fail closed when credit, entitlement, rate, or policy state cannot be verified.
- Reserve the maximum bounded provider cost before generation.
- Record every billable primary, fallback, continuation, tool, vision, speech, and memory-summary attempt.
- Use a 1,536-token normal reply budget and a 2,048-token multi-part hard cap from the conversation-quality plan.
- Persist provider results before delivery; retries must resume from persisted results instead of generating again.
- Apply customer credit and provider-cost ledger entries idempotently; D1 remains canonical.
- Keep provider-supported idempotency keys stable across retries; do not claim atomic exactly-once behavior across an external provider and Cloudflare storage.
- Keep one bounded journal object per customer/assistant scope, with attempt IDs stored as records; do not create an object per provider call.

## Review Focus

- A fallback model may return text after the primary model was billable; Task 3 tests settlement of every attempt.
- A queue retry may race with an active Worker; Task 3 tests duplicate in-flight claims.
- A provider may time out after accepting a request; Task 2 tests the unknown-outcome state and blocks blind regeneration.
- D1 may fail after provider output is journaled; Task 4 tests replay and exactly-once D1 ledger application.
- A balance can be reserved while monthly cap or provider envelope policy changes; Task 2 verifies the reservation and policy snapshot used for settlement.

---

### Task 1: Add the scoped Durable Object result journal

**Files:**
- Create: customer-apps/assist/src/billing/settlement-journal.ts
- Modify: customer-apps/assist/src/index.ts
- Modify: customer-apps/assist/wrangler.jsonc
- Create: customer-apps/assist/scripts/settlement-journal.test.mjs
- Modify: customer-apps/assist/package.json

**Interfaces:**
- Produces: recordAttemptStarted(attempt: ProviderAttemptStarted) -> Promise<JournalAttempt>
- Produces: recordAttemptResult(attemptId: string, result: ProviderAttemptResult) -> Promise<JournalAttempt>
- Produces: getAttempt(attemptId: string) -> Promise<JournalAttempt | null>
- Produces: markAttemptSettled(attemptId: string, settlementId: string) -> Promise<void>
- JournalAttempt states are started, result_recorded, settled, and unknown_outcome.
- Durable Object identity is derived from customer ID and assistant ID; multiple stable attempt IDs are stored in that object.

- [ ] **Step 1: Add failing tests** named testAttemptResultPersistsBeforeDelivery, testRepeatedResultWriteIsIdempotent, testAttemptIdsCannotCrossCustomerAssistant, and testUnknownOutcomeDoesNotBecomeRetryableGeneration.
- [ ] **Step 2: Run the focused test** with node --experimental-strip-types --test scripts/settlement-journal.test.mjs. Expected: the journal tests fail.
- [ ] **Step 3: Implement the Durable Object journal** using its transactional storage for bounded attempt records. Store request hash, reservation ID, provider/model, response text, input/output usage, cost, timestamps, and settlement status. Retain unresolved records until reconciled and expire settled records only after the configured retention period.
- [ ] **Step 4: Configure the Durable Object binding and migration tag** in wrangler.jsonc and export the class from src/index.ts. Run Wrangler dry-run.
- [ ] **Step 5: Run the focused tests.** Expected: repeated records return the same state; customer/assistant scoping rejects mismatched identities.
- [ ] **Step 6: Commit** with message feat(assist): add durable provider result journal.

### Task 2: Make provider attempts stable and replay-safe

**Files:**
- Modify: customer-apps/assist/src/runtime.ts
- Modify: customer-apps/assist/src/billing/settlement-journal.ts
- Modify: customer-apps/assist/scripts/settlement-journal.test.mjs

**Interfaces:**
- Consumes: journal functions from Task 1.
- Produces: executeJournaledProviderAttempt(input: ProviderAttemptInput) -> Promise<ProviderAttemptResult>
- Each call to a primary/fallback/continuation/tool/vision/speech model has a distinct stable attempt ID derived from its reply job, reservation, and attempt ordinal.

- [ ] **Step 1: Add failing tests** named testProviderSuccessIsJournaledBeforeReturn, testFallbackAttemptsKeepSeparateUsage, testRetryReusesRecordedResult, and testAcceptedTimeoutIsNotBlindlyRepeated.
- [ ] **Step 2: Run the focused tests.** Expected: the new provider replay tests fail.
- [ ] **Step 3: Wrap each billable provider call** with journal start/result writes. Pass provider idempotency keys where supported. If a previous attempt has result_recorded, reuse its output; if it has unknown_outcome, defer and alert for reconciliation instead of submitting another paid request.
- [ ] **Step 4: Run the focused tests.** Expected: a retry of a recorded attempt performs zero provider calls and preserves each attempt's exact usage.
- [ ] **Step 5: Commit** with message feat(assist): replay recorded provider attempts.

### Task 3: Apply D1 reservations and settlements idempotently

**Files:**
- Create: customer-apps/assist/src/billing/inference-settlement.ts
- Create: customer-apps/assist/migrations/0034_idempotent_inference_attempts.sql
- Modify: customer-apps/assist/src/runtime.ts
- Modify: customer-apps/assist/src/billing/settlement-journal.ts
- Create: customer-apps/assist/scripts/inference-settlement.test.mjs
- Modify: customer-apps/assist/package.json

**Interfaces:**
- Produces: reserveInference(input: InferenceReservationInput) -> Promise<InferenceReservation>
- Produces: settleInference(input: InferenceSettlementInput) -> Promise<SettlementResult>
- InferenceSettlementInput includes reservation ID, stable attempt IDs, actual customer credits, provider cost, usage units, and provider/model identities.

- [ ] **Step 1: Add failing tests** named testReservationIsUniquePerReplyJob, testSettlementWritesLedgerAndUsageAtomically, testDuplicateSettlementDoesNotDoubleCharge, and testUnusedReservationIsReleasedOnce.
- [ ] **Step 2: Run the focused tests.** Expected: the new D1 settlement tests fail.
- [ ] **Step 3: Add migration 0034** with a unique stable idempotency key for reply-job reservation and provider-attempt usage, and required indexes. Do not rewrite historical ledger entries.
- [ ] **Step 4: Implement reserveInference and settleInference** so a D1 batch atomically claims the reservation, updates the account balance, and inserts unique usage, provider-cost, and ledger rows. Treat duplicate application as an already-completed result. Release unused reservation only after all attempt outcomes are known.
- [ ] **Step 5: Run local D1 migration and focused tests.** Expected: duplicate settlement leaves the balance and event counts unchanged.
- [ ] **Step 6: Commit** with message feat(assist): settle inference attempts exactly once.

### Task 4: Recover journaled replies and verify production economics

**Files:**
- Modify: customer-apps/assist/src/runtime.ts
- Modify: customer-apps/assist/src/index.ts
- Modify: customer-apps/assist/scripts/check-production-acceptance.mjs
- Modify: customer-apps/assist/scripts/check-security-isolation.mjs
- Modify: .github/workflows/mkety-assist-ci.yml
- Modify: .github/workflows/mkety-assist-deploy.yml
- Modify: customer-apps/assist/package.json
- Create: customer-apps/assist/scripts/settlement-recovery.test.mjs

**Interfaces:**
- Consumes: journaled provider results and idempotent D1 settlement from Tasks 1-3.
- The existing reply queue and scheduled recovery path resume pending settlements and delivery from stable reply-job and attempt IDs.

- [ ] **Step 1: Add failing tests** named testD1OutageAfterResultReplaysWithoutGeneration, testDeliveryRetryDoesNotRepeatSettlement, testEveryFallbackAttemptMatchesProviderCost, and testHumanTakeoverStillBlocksPendingDelivery.
- [ ] **Step 2: Run the focused tests.** Expected: injected storage failures show missing recovery or duplicate provider calls.
- [ ] **Step 3: Implement reply-job recovery** so a result_recorded attempt settles and delivers after D1 recovers, and an unknown_outcome attempt remains held for operator reconciliation. Preserve pause and human-handoff checks before delivery.
- [ ] **Step 4: Extend production acceptance** to inject D1 failure after provider return, replay the same job, and verify one provider response is delivered, one customer settlement is applied, every provider cost is recorded, and aggregate mismatch is zero.
- [ ] **Step 5: Run verification** from customer-apps/assist: npm run type-check; npm run check:all; npx wrangler d1 migrations apply DB --local; npx wrangler deploy --dry-run --outdir /tmp/mkety-assist-dry --config wrangler.ci.jsonc.
- [ ] **Step 6: Commit** with message test(assist): verify journal recovery and credit reconciliation.

### Verification for this plan

- Run from customer-apps/assist: npm run type-check
- Run from customer-apps/assist: npm run check:all
- Run all added focused Node test scripts with Node 22 and --experimental-strip-types.
- Run the isolated Assist Wrangler D1 migration and deploy dry-run used by CI.
- Expected: no duplicate provider attempt, customer credit debit, provider-cost event, or delivered reply after queue and D1 replay.

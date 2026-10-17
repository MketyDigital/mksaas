# Assist Ops Credit Review and Cap Policy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or subagent-driven-development where approved) to execute tasks sequentially. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add Ops-only, evidence-based handling of unresolved Assist/API inference reservations, improve monthly assistant-cap semantics and concurrency safety, and preserve live assistant behavior and data.

**Architecture:** Keep this entirely within standalone `customer-apps/assist`. Reuse existing operator-session authentication, settlement journal, reservation tables, and credit ledger. Add narrowly scoped, additive D1 schema only where current tables cannot represent Ops review/disposition or cap mode. Enforce Ops visibility in handlers and query projections; owner routes continue returning only owner-scoped balances, aggregate usage, and that owner's cap settings. No Platform DB calls or provider/model behavior changes.

**Tech Stack:** TypeScript Cloudflare Worker, D1 SQL migrations, existing Assist node test scripts, Vitest/Worker tooling where already configured.

## Safety invariants

- Never read or write the Mkety Platform database.
- No prompt, message, secret, request body, raw provider payload, Ops note, attempt ID, reservation ID, unresolved status, or held-credit detail reaches an owner API/page/export/notification or assistant context.
- Every review read/write requires a valid Ops session and validates tenant/workload/attempt relationships from D1.
- Do not automatically clear historical holds, infer usage, settle at reserved maximum, or retry an unknown attempt.
- Preserve current assistant status, model routing, prompt assembly, knowledge, channels, and account funding/provider gates.
- Existing assistants remain uncapped after migration; `NULL` is no cap. Hard caps require explicit owner selection.
- Every credit movement remains idempotent and exactly reconciled between reservation/account/ledger/journal.
- No production D1 writes or deploy during implementation verification.

## Task 1: Lock down existing Ops and owner API boundaries

**Files:**
- Modify: `customer-apps/assist/src/index.ts`
- Modify: `customer-apps/assist/src/ui.ts` (Ops UI only where needed)
- Test: existing Ops/owner API tests and add focused route tests

- [ ] Trace all Ops inference-attempt GET and resolve routes, session middleware, owner routes, exports, notifications, and serialization paths.
- [ ] Add tests proving unauthenticated and owner sessions cannot access `/api/ops/inference-attempts` or resolve attempts; test cross-customer IDs and workload-ID mismatches.
- [ ] Ensure Ops route requires valid Ops session before any review queries; constrain customer/workload/attempt joins at SQL boundaries.
- [ ] Audit owner DTO construction and ensure no reservation/reconciliation/evidence fields leak; preserve normal balance and aggregate usage.
- [ ] Run focused tests; inspect the route diff and responses.

## Task 2: Add complete paginated Ops review queue

**Files:**
- Modify: `customer-apps/assist/src/billing/reconciliation.ts`
- Modify: `customer-apps/assist/src/index.ts`
- Modify: `customer-apps/assist/src/ui.ts` and Ops-only styles/templates
- Test: `customer-apps/assist/scripts/reconciliation.test.mjs` and Ops route tests

- [ ] Inventory both attempt-index schemas and supporting reservation, settlement, usage, provider-cost, journal, and resolution records.
- [ ] Add a cursor-safe query covering both assistant and raw API workloads, all unresolved states, stable ordering, and bounded page sizes; avoid loading message or provider payload content.
- [ ] Return only approved safe metadata; represent pending amounts with exact atom/MKredit conversion and workload type.
- [ ] Add Ops-only pagination and filters; preserve existing operator flows and no owner navigation or API linkage.
- [ ] Test pages across more than 100 rows, duplicate timestamps, both workload types, journal-result states, and tenant isolation.

## Task 3: Add audited Ops disposition and pending-review records

**Files:**
- Add: additive migration under `customer-apps/assist/migrations/`
- Modify: `customer-apps/assist/src/billing/reconciliation.ts`
- Modify: `customer-apps/assist/src/index.ts` (Ops resolve API)
- Modify: Ops UI files
- Test: reconciliation, migration, and route tests

- [ ] Design schema from the actual current migration chain; preserve existing reservation and credit-ledger tables as authoritative.
- [ ] Add explicit evidence-required Ops decision records with actor, tenant, attempt/reservation link, idempotency key, amount, reason, evidence summary, and timestamp. Avoid duplicate balance state.
- [ ] Keep unresolved items pending; support exact-usage settlement, confirmed-not-submitted release, recovered durable result, evidenced Mkety absorption, separately recorded goodwill adjustment, and keep-pending.
- [ ] Validate required evidence and amount constraints per outcome; reject unsupported combinations and stale or cross-tenant references.
- [ ] Make actions idempotent under repeated requests and concurrent clicks; preserve journal/reply-job recovery semantics.
- [ ] Add ledger/account invariants and tests for partial returns if required by evidence. Never process a bulk financial mutation without a per-attempt disposition.
- [ ] Test failed/interrupted DB batches, repeat action, changed idempotency payload, and stale rows.

## Task 4: Clarify monthly cap values and modes

**Files:**
- Add: additive migration under `customer-apps/assist/migrations/`
- Modify: `customer-apps/assist/src/assistants/service.ts`
- Modify: `customer-apps/assist/src/index.ts` owner assistant API validation
- Modify: `customer-apps/assist/src/ui.ts` owner cap editor
- Test: assistant service/API/UI behavior tests

- [ ] Verify actual schema types, current cap editing path, and all API callers.
- [ ] Add nullable cap mode (`soft`/`hard`) without changing assistant rows except converting legacy `0` cap to `NULL`; prove migration leaves balances, usage, statuses, and prompts unchanged.
- [ ] Validate blank as explicit `NULL`, positive finite values only for a configured cap, and reject negative/zero-as-limit/non-finite input.
- [ ] Ensure updates distinguish omitted field (no change) from explicit null (clear cap) and use customer+assistant scoping.
- [ ] Explain owner-visible units as MKredits and show only own assistant's cap and aggregate month usage/warning.
- [ ] Make soft mode warn without blocking. Do not add a default cap or silently convert existing settings to hard mode.

## Task 5: Make opted-in hard-cap reservation atomic and concurrency-safe

**Files:**
- Modify: `customer-apps/assist/src/billing/inference-settlement.ts`
- Test: `customer-apps/assist/scripts/inference-settlement.test.mjs` and focused concurrency tests

- [ ] Define month boundary in UTC and confirm stored cap/usage units are consistently credit atoms before code changes.
- [ ] Include settled month usage plus open reservations in cap allowance; make reservation debit, reservation-row creation, ledger insertion, and cap conditional check a single safe D1 batch/conditional-write sequence.
- [ ] Preserve idempotency behavior on replayed reservation keys and prevent duplicate ledger rows.
- [ ] Ensure settlement transfers exposure from open reservation to actual usage exactly once; ensure release restores available balance but does not add usage.
- [ ] Test parallel reservations at the threshold, settlement/refund, release, uncapped `NULL`, soft-cap continuation, zero legacy normalization, and account-balance failure.

## Task 6: End-to-end verification and deployment package

**Files:**
- Modify docs only for final runbook/results

- [ ] Run focused Assist tests, then full Assist tests, lint/type-check/build and route/security checks using repository-documented commands.
- [ ] Apply migrations only to local test DB; compare before/after snapshots for balances, usage, assistant statuses/settings, and prompt-related data.
- [ ] Run static search to confirm no Platform DB imports and no owner response containing Ops fields.
- [ ] Review full diff for unrelated files, migrations, generated artifacts, credentials, and behavior changes.
- [ ] Record exact commit/tree SHA and tests, prepare guarded exact-head deployment instructions; do not dispatch a workflow or mutate production unless separately requested.
- [ ] Do not resolve the 143 raw API holds or two assistant holds in this code change. Their later Ops dispositions require per-attempt evidence and operator action.

## Out of scope

- Resolving existing production reservations or changing any live credit balance.
- Any main Mkety Platform DB access or cross-product balance transfer.
- New pricing for unknown usage, automatic hold expiration/refund, or bulk settlement.
- Prompt/model/channel/knowledge changes, provider retry policy changes, or enabling GPT-5.6 Sol.
- Production deploy, secret changes, or Cloudflare account changes.

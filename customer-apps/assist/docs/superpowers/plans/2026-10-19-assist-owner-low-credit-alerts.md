# Assist Owner Low-Credit Alerts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Notify authenticated Assist workspace owners/admins when spendable credits cross a soft reminder threshold or the 2,000 MKredit low-balance threshold.

**Architecture:** Keep alerts outside customer conversation, inference, prompt, queue, and credit-gating logic. A D1 trigger on the existing credit ledger will durably record threshold crossings in an owner-alert outbox in the same transaction as a ledger entry; the existing scheduled Worker processes that outbox through the already-linked owner Telegram identity. The authenticated owner portal projects the current status from the account and billing allocation, with per-user notification preferences.

**Tech Stack:** Cloudflare Worker, D1/SQLite migrations and triggers, TypeScript, existing Telegram delivery helper, owner portal UI, Node unit tests.

**Spec:** Approved conversation design (2026-10-19): soft alert at 20% of the standard monthly MKredit allocation; critical alert at 2,000 MKredits; suppress soft tier when it is at or below critical; if a single debit crosses both, enqueue only critical; re-arm after refill above soft. Notifications are owner/admin only and never enter customer chats or alter assistant behavior.

## Global Constraints

- Preserve fail-closed credit reservation and existing customer reply behavior.
- Do not modify prompt construction, chat messages, reply jobs, assistant pauses, handoffs, or inference routing.
- Do not expose Ops-only reservation, provider, reconciliation, or ledger investigation fields to owners.
- Keep customer isolation by authenticated `customer_id`; never accept customer IDs from request bodies for owner settings.
- Telegram deliveries use only authenticated linked identities and are sent outside request/conversation processing.
- Existing balances at deployment do not cause a retroactive Telegram blast; current low state is visible in the portal and Telegram alerts start on later threshold crossings.

## Review Focus

- A debit that crosses both thresholds enqueues only critical; a debit crossing only soft enqueues soft.
- Refill above the soft threshold re-arms alert tiers exactly once; partial refill below it does not.
- D1 trigger/outbox work remains transactional with balance changes and is independent of chat queues.
- Telegram recipient lookup excludes members, disabled users, unlinked identities, and opted-out owners.
- Members do not receive the owner low-credit projection or preference control.

---

### Task 1: Threshold projection and owner portal

**Files:**
- Create: `customer-apps/assist/src/billing/credit-alerts.ts`
- Modify: `customer-apps/assist/src/index.ts`
- Modify: `customer-apps/assist/src/ui.ts`
- Test: `customer-apps/assist/scripts/credit-alerts.test.mjs`

**Interfaces:**
- Produce `creditAlertProjection(balanceAtoms: number, monthlyAtoms: number)` returning level (`normal | soft | critical`) and public thresholds in MKredit.

- [x] Write tests for soft, critical, boundary, below-2,000-allocation, and disabled-allocation projections; run to confirm expected failures.
- [x] Implement the minimal pure projection helper.
- [x] Add owner/admin-only alert projection to `/api/usage` and display an owner portal notice without changing any conversation UI.
- [x] Run the focused tests and Assist type-check.

### Task 2: Durable threshold-crossing outbox and Telegram delivery

**Files:**
- Create: `customer-apps/assist/migrations/0047_owner_credit_alerts.sql`
- Modify: `customer-apps/assist/src/runtime.ts`
- Modify: `customer-apps/assist/src/ui.ts`
- Test: `customer-apps/assist/scripts/credit-alerts.test.mjs`

**Interfaces:**
- Add owner credit-alert preference (default enabled), per-customer armed threshold state, and a deduplicated D1 outbox.
- Add a D1 credit-ledger insert trigger to enqueue debit crossings and re-arm only on actual funding kinds (`topup`, `plan_funding`, or positive `operator_adjustment`); temporary reservation releases/refunds never re-arm. No existing application credit mutation API is changed.
- Process outbox rows from the existing scheduled handler; target only active owner/admin users with an authenticated linked Telegram identity and enabled preference.

- [x] Add local SQLite tests for migration-trigger soft/critical crossing, both-crossed suppression, re-arming, and duplicate-update behavior; run to confirm failures.
- [x] Add a preference checkbox to existing Owner alerts settings and owner-scoped API handling.
- [x] Add bounded scheduled outbox processing with per-recipient delivery state/retries and safe logging.
- [x] Run focused tests, Assist unit suite, checks, and type-check.

### Task 3: Boundary verification

**Files:**
- Test: `customer-apps/assist/scripts/credit-alerts.test.mjs`
- Verify: `customer-apps/assist/src/runtime.ts`, `customer-apps/assist/src/index.ts`

- [x] Assert low-credit notification code is not called from customer message or inference paths and does not mutate reply jobs, prompts, assistant status, or handoffs.
- [x] Run `npm run check:all` in `customer-apps/assist` and inspect the final diff.
- [x] Do not apply migrations to production or deploy from this task; prepare the branch for review.

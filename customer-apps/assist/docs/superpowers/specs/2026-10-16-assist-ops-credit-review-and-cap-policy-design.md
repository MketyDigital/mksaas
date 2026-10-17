# Assist Ops Credit Review and Cap Policy

**Status:** Draft for owner review
**Scope:** Standalone Mkety Assist billing and Ops reconciliation only
**Production changes:** None are authorized by this design document

## Intent

Keep Assist available when a previous provider outcome is uncertain, protect Mkety from unbounded provider-cost exposure, and give Ops explicit control over whether uncertain credits are retained, absorbed, or returned to the Assist customer. Add useful owner-configurable monthly spend controls without silently imposing limits on live assistants.

The seven-day audit identified 143 open raw API-key reservations totaling 96,065,520 credit atoms. These are not the four Assist assistants' monthly caps. The assistants had two open assistant reservations totaling 256,668 atoms in the same period. Raw API reservations and assistant reservations use separate tables and must remain separate in reconciliation and cap enforcement.

## Current behavior and constraints

- A provider attempt with `unknown_outcome` is not blindly replayed. The same attempt remains held until evidence supports a resolution.
- Ops can confirm no submission, settle evidenced usage, recover a durable result, absorb an evidenced provider cost, or leave an attempt unresolved.
- The `mkety_absorbed_cost` action requires exact provider-cost evidence and currently releases customer credits as part of the chosen action. There is no separate Ops pending-credit decision state.
- Customer route prices can be used when provider cost is unknown if customer-billable units are known. That does not create usage units when the provider outcome and usage are both unknown.
- `monthly_credit_cap` is optional. A stored value of `0` behaves like no cap. The current cap check reads settled monthly usage before reservation, does not include other open reservations, and is not atomic with reservation creation.
- Assist's existing customer-balance, commercial-policy, route-health, and provider-budget gates remain authoritative. A reconciliation item must not pause the whole assistant or cause the same provider attempt to be submitted again.
- Assist owns its own credit ledger. Do not read or write the Mkety Platform database.

## Proposed design

### 1. Ops-controlled uncertain-credit review

Extend the existing Ops inference-attempt view into a paginated, workload-aware review queue covering both `inference_attempt_index` (assistant work) and `workload_inference_attempt_index` (raw API-key work). This queue, its attempt-level records, pending amounts, evidence, resolution history, and operator actions are **Ops-only**. They must not appear in owner/customer pages, APIs, exports, notifications, or assistant context. Enforce the boundary at the server route and data-query layers, not only by hiding UI controls; unauthenticated and owner sessions receive no access. Display only safe metadata to authorized Ops: tenant, workload identity, model alias/provider/model, attempt and reservation IDs, status, age, reserved/settled amounts, journaled usage/cost when present, and resolution history. Never expose prompts, full message content, API secrets, request bodies, or raw provider payloads.

Keep an uncertain reservation financially pending until an operator selects and records a disposition. “Return to Ops” means an Ops-owned pending-credit review item inside the Assist Ops ledger workflow; it does not transfer customer credits into the separate Mkety Platform database or create a spendable cross-product wallet. The original reservation remains the source of truth until Ops posts a disposition. Show the exact amount pending an Ops decision only in the Ops interface. Owners may see their ordinary available MKredit balance and general usage totals, but must not see unresolved attempt IDs, held-credit amounts, provider outcomes/evidence, Ops notes, or review status. Ops choices must remain distinct:

1. **Confirmed not submitted:** release the reservation to its original customer only with reliable no-submission evidence.
2. **Exact usage evidenced:** settle customer credits from the attempt's immutable rate snapshot and provider-reported billable units.
3. **Recovered journal result:** settle the recorded result and continue the existing reply-delivery recovery path; never generate a replacement response for the same attempt.
4. **Mkety absorbs evidenced provider cost:** record provider cost to Mkety and return customer credits only as an explicit Ops decision supported by evidence.
5. **Ops-authorized customer credit return or adjustment:** issue a separately auditable credit-ledger adjustment, with amount, reason, evidence, operator, and idempotency key. This may be a goodwill decision; label it as such rather than representing it as provider usage.
6. **Keep pending:** preserve the reservation and review record when evidence is insufficient.

Do not automatically release, settle at the maximum reservation, invent token counts, or refund an owner solely because an attempt is old. No bulk action may change balances without a per-attempt evidence/disposition record. Repeated submission of an Ops action must be idempotent.

### 2. Service continuity

An unresolved prior attempt must not set the assistant's global status to paused/disabled and must not block unrelated conversation IDs. It must continue to block replay of that same attempt. New paid inference remains subject to the existing balance, rate, route, and provider-budget checks; this change must not create implicit credit or provider-cost exposure for Mkety. If those existing gates cannot authorize a new call, the system returns its current safe billing/provider error without altering the assistant configuration.

When a journal already contains `result_recorded`, recovery should settle/deliver from the journal and clear the pending item. A transient D1 or Ops UI outage must not erase the durable result, release the reservation, or cause paid regeneration.

### 3. Monthly assistant caps

Make the meaning explicit and preserve existing live behavior:

- `NULL` means **No cap**. Normalize legacy `0` values to `NULL` in an additive migration; do not change any balance or usage rows.
- A missing cap remains uncapped. Do not assign a platform-selected limit to the four existing live assistants.
- A positive configured cap can be **soft** (warn the owner in their own account and Ops, and continue while existing funding/provider gates pass) or **hard** (block only new reservations once the chosen limit is reached). Hard mode is explicit and owner-selected; it is never silently enabled by migration. Cap warnings expose only that assistant's cap and aggregate month-to-date usage, never any unresolved hold details or another customer's data.
- Explain that values are in MKredits in the owner UI and preserve the existing conversion of 10,000 credit atoms per MKredit.
- Make blank/no-cap and a positive cap distinct in the editor/API. Reject negative, non-finite, and zero-as-a-cap inputs; clearing a cap must store `NULL` intentionally.
- Enforce a hard cap using settled assistant credits for the UTC month plus outstanding open reservations for that assistant. Perform the cap check and account reservation in one serialized D1 write batch/conditional-write path so parallel requests cannot pass against the same remaining allowance.
- On settlement, move the amount from open reservation exposure to actual usage in the same idempotent settlement flow. Do not count it twice or allow an open reservation to bypass the cap.
- Soft-cap alerts must not pause the assistant. Hard-cap behavior applies only when an owner explicitly selects it and the limit is reached. Raw API-key usage is not charged against an assistant cap.

The account balance and existing provider-budget protections continue to limit platform exposure independently of a per-assistant cap.

## Data and API changes

- Add additive Assist D1 schema only where needed for an explicit Ops credit-adjustment/review record and cap mode. Keep the existing reservation tables authoritative; do not create a competing balance ledger. Review endpoints and queries must require an Ops session; owner APIs must not join or return Ops review/evidence fields.
- Every adjustment references exactly one original customer and reservation/attempt, and stores a unique idempotency key, operator identity, amount, reason, evidence summary, and creation time.
- Keep operator actions authenticated and scoped to the customer/workload/attempt loaded from D1; never trust a request-body customer ID without validating the attempt against it.
- Use existing settlement and release primitives wherever their semantics match. Add narrowly scoped ledger operations for an Ops-authorized partial return only if existing primitives cannot represent it correctly.
- Do not add a new provider inference call, alter prompts, change model routing, or change production credentials as part of this work.

## Rollout and safety

1. Implement on an isolated branch from current `main`; do not include unrelated dependency or product-positioning changes.
2. Add tests before implementation for both workload types, idempotency, tenant isolation, evidence validation, pending-state behavior, and cap concurrency.
3. Apply the additive migration locally and verify legacy `0` caps become `NULL` without balance/usage changes.
4. Run Assist reconciliation, settlement, security-isolation, operator-UI, type-check, and production-acceptance checks.
5. Review the exact diff and migration against live schema. Deploy only through the guarded Assist workflow after exact-head checks pass.
6. Do not resolve the existing 143 raw API holds or two assistant holds as part of code deployment. Reconcile those separately through Ops after inspecting attempt-level evidence and recording each chosen disposition.
7. Verify production health, existing assistant prompt behavior, normal inference settlement, soft-cap continuation, opted-in hard-cap enforcement, Ops pagination, and audit records. Roll back code if behavior regresses; retain additive audit history.

## Acceptance criteria

- A provider-unknown attempt is never resent under the same attempt ID.
- One unresolved attempt does not pause an assistant or block an unrelated conversation when current funding and provider policy allow the new call.
- Ops can review every unresolved assistant and raw API attempt across pages and make a separate audited disposition for each.
- Only authenticated Ops can view or mutate unresolved attempt details, held-credit amounts, evidence, resolution history, or operator notes; owner endpoints and rendered pages expose none of those fields.
- Owners can view and configure only their own assistant's cap mode/amount and aggregate usage/warnings; they cannot view Ops reconciliation state.
- No customer credit is returned or charged for unknown usage without an explicit configured/evidenced decision recorded in the audit trail.
- All reservation, settlement, release, and adjustment operations are idempotent and reconcile to the credit ledger/account balance.
- Existing uncapped assistants remain uncapped after migration; no live assistant receives a new hard cap automatically.
- Soft caps warn without blocking. Explicit hard caps include open reservations and are concurrency-safe.
- Prompts, knowledge, memory, channel behavior, model routes, and existing billing policy remain unchanged apart from the selected cap/reconciliation behavior.
- The deployment makes no writes to D1 except the reviewed additive migration and explicit Ops actions; the migration does not rewrite historical balances or usage.

## Open policy item for implementation review

This design intentionally does not invent an unknown-outcome unit price. When exact billable usage is unavailable, Ops may keep the hold, return credits as a recorded goodwill/owner adjustment, or choose a documented Mkety absorption action when provider cost is evidenced. If Mkety wants an automatic fixed unknown-outcome fee later, that is a separate pricing decision requiring an explicit amount, customer disclosure, route scope, and effective-date policy before implementation.

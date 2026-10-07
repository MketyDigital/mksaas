# Starpips Enterprise Mail Customer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Starpips Mkety Mail's first paid enterprise customer, verify the real customer Mail journey, and only then use Mkety's internal staging system to verify Enterprise AI.

**Architecture:** Sell and provision Mkety Mail through its existing tenant, billing, verified-settlement and `workspace.mail` entitlement paths. Verify customer-owned domain routing and core Mail operations for Starpips; after that customer acceptance passes, run the existing guarded non-production Enterprise AI commercial/runtime acceptance with an ephemeral Mkety-owned fixture.

**Tech Stack:** TypeScript, Next.js, Drizzle/PostgreSQL, Mkety Billing/payment providers, Mkety Mail dispatch queue and Cloudflare Email Sending, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-02-mkety-first-party-mail-and-starpips-pilot-design.md`

## Global Constraints

- Starpips is the first paid enterprise customer of Mkety Mail, not an Enterprise AI customer.
- Use only explicitly recorded Mail plan or approved custom contract terms, currency and price; do not invent commercial terms.
- Activate Mail access only through provider-verified payment settlement and the normal idempotent `workspace.mail` entitlement path.
- Never grant paid access by direct database mutation or browser return; preserve billing and payment audit records.
- Verify sending, receiving, team access, suppression, rate limits and usage against the actual contracted Mail plan.
- Do not use Starpips' Mail tenant as Mkety's internal test environment.
- Run the Mkety AI internal test client only after Starpips' complete Mail acceptance passes; keep customer external-client access disabled globally.
- Do not modify files under `customer-apps/assist` or rewrite the standalone Assist branch.

## Review Focus

- Missing or ambiguous Starpips commercial terms must stop checkout before entitlement changes; cover in the read-only preflight and checkout journey tests.
- Browser return without provider settlement must not grant Mail access; cover in existing billing settlement tests.
- Duplicate or mismatched payment events must not create extra entitlement or usage; cover in settlement/idempotency tests.
- Starpips Mail data and the later ephemeral Enterprise AI fixture must remain tenant-isolated; cover in Mail authorization and Enterprise AI acceptance tests.
- A failed domain, delivery, suppression or capacity check must remain visible and must not count as successful customer acceptance; cover in gateway and sending-policy tests.

## Implementation review follow-up — Mail quota concurrency

A review identified that concurrent mailbox creation and shared-thread assignment could both observe available seats or mailbox capacity and over-allocate. The fix is complete in PR #348 at code head `d23edfae53fbf7d085bdb8ad3584f8691211d232`:

- Mailbox creation and shared-thread assignment acquire a tenant-scoped PostgreSQL transaction lock and recheck limits under that lock; the relevant write is committed in the same transaction.
- Seat usage counts distinct users across mailbox members and shared-inbox assignees. Existing members/assignees reuse their seat; unchanged assignments are not rejected at capacity.
- Focused pure-helper tests cover seat reuse, cap enforcement, deduplication across roles, open capacity, and uncapped internal plans. The exact code-head CI/tests/typecheck/lint/build/migration and candidate runs are recorded in `docs/CURRENT_WORKSTREAM_STATUS.md`.
- Independent follow-up review found no remaining actionable issue in the quota paths.

This completes the repository implementation follow-up only. It does not complete Starpips' approved terms, payment, domain onboarding, delivery, or customer acceptance; those remain open below.

---

### Task 1: Read-only Starpips Mail and commercial preflight

**Files:**
- Read: `src/features/mail/commercial/plans.ts`
- Read: `src/features/billing/catalog/self-service-plans.ts`
- Read: `src/features/mail/server/commercial.ts`
- Read: `src/features/mail/server/admin-actions.ts`
- Read: `src/features/mail/server/admin-queries.ts`
- Read: `src/app/api/tenants/[tenant]/billing/checkout/route.ts`
- Read: `src/app/api/webhooks/billing/nowpayments/route.ts` and the configured Flutterwave settlement route

**Interfaces:**
- Produces: a non-secret read-only record of the canonical Starpips tenant, existing Mail subscription/contract, exact price/currency, configured contact/domain, chosen payment method and current `workspace.mail` entitlement. No mutations.

- [ ] **Step 1: Inspect the current Mail offer and Starpips account**

Use authenticated read-only Platform Control/Billing views. Identify the exact current Mail plan or existing approved custom agreement for Starpips, currency, price, billing period, contact and domain. Do not infer the right plan from the word “enterprise.”

- [ ] **Step 2: Confirm payment and entitlement route**

Confirm that the selected Mail offer can be checked out using an enabled provider and that verified settlement grants the Mail entitlement idempotently. Record the existing customer/provider identifiers without printing secrets.

- [ ] **Step 3: Stop on absent or ambiguous commercial terms**

If there is no recorded Starpips Mail offer/agreement, do not create checkout or entitlement state. Return the specific missing business terms for user decision.

### Task 2: Pin Mail payment and entitlement safety

**Files:**
- Modify: focused billing checkout and settlement tests under `src/app/api/tenants/[tenant]/billing/` and `src/app/api/webhooks/billing/`
- Modify: `src/features/mail/server/commercial.test.ts` or a focused entitlement journey test

**Interfaces:**
- Consumes: existing plan, checkout and settlement contracts.
- Produces: tests proving only verified, matching settlement activates the Starpips Mail entitlement once; browser return, wrong amount/currency and duplicate settlement do not grant extra access.

- [ ] **Step 1: Add failing Mail purchase journey assertions**

Cover missing plan/contract, incorrect amount/currency, unverified browser return, valid provider settlement, duplicate event replay and resulting `workspace.mail` access.

- [ ] **Step 2: Run the focused tests to locate gaps**

Run the owning checkout/settlement and Mail commercial test files by path.
Expected: any newly added uncovered behavior fails before changes.

- [ ] **Step 3: Fix only demonstrated checkout or settlement defects**

Use the existing billing checkout, provider verification and entitlement machinery. Do not add a Starpips-specific grant or an alternate settlement path.

- [ ] **Step 4: Verify focused tests**

Run the same test files.
Expected: exact terms, verified settlement, idempotency and entitlement assertions pass.

### Task 3: Prepare Starpips tenant and customer-owned Mail domain

**Files:**
- Read/run: `src/features/mail/server/workspace.ts`
- Read/run: `src/features/mail/server/domain-actions.ts`
- Read/run: `src/features/mail/server/mailbox-actions.ts`
- Read/run: `src/features/mail/server/sending-policy.ts`
- Modify: focused domain and onboarding tests in `src/features/mail/server/`
- Modify: `docs/handoffs/2026-09-29-mail-production-gateway-next.md` with acceptance evidence

**Interfaces:**
- Consumes: paid Starpips Mail entitlement and the confirmed customer domain.
- Produces: Starpips Mail workspace, domain ownership/verification state, inbound routing and outbound sender readiness belonging to the Starpips tenant.

- [ ] **Step 1: Verify Starpips tenant identity and Mail entitlement after settlement**

Confirm the billing subscription/settlement and entitlement all point to the same canonical Starpips tenant before creating domain or mailbox records.

- [ ] **Step 2: Review customer DNS without mutation**

Read the provided domain's MX, SPF, DKIM, DMARC and routing state. Stop before changes if records would break an existing provider or the domain owner has not approved the proposed Mail routing.

- [ ] **Step 3: Configure the customer domain through Mail controls**

Use existing Mail domain actions to provision and verify DNS/routing. Preserve existing records unless an explicitly reviewed change is required. Confirm the resulting domain remains attached to Starpips tenant ID.

- [ ] **Step 4: Verify domain onboarding and tenant isolation**

Run focused tests proving a different tenant cannot claim, send from or route messages through the Starpips domain.

### Task 4: Accept the paid Starpips Mail customer journey

**Files:**
- Read/run: `src/app/app/[tenant]/mail/` customer Mail surfaces
- Read/run: `src/app/api/v1/mail/send/route.ts`
- Read/run: `src/app/api/internal/mail/gateway/submit/route.ts`
- Read/run: `src/features/mail/server/{message-actions,shared-inbox-actions,sending-policy}.ts`
- Modify: `docs/handoffs/2026-09-29-mail-production-gateway-next.md`

**Interfaces:**
- Produces: exact-SHA evidence for Starpips login, paid entitlement, domain, mailbox/team setup, inbound/outbound delivery, shared inbox if included, capacity/suppression, audit and usage behavior.

- [ ] **Step 1: Verify the contracted customer dashboard**

Confirm the Starpips tenant sees Mail only after verified settlement and sees its plan's actual quota and features. Confirm no internal operational data or another tenant's messages are exposed.

- [ ] **Step 2: Exercise sending and receiving**

Send a controlled message through the Mail product/API and receive a reply through the configured customer domain. Verify queued, provider and delivery-event states on the exact candidate SHA.

- [ ] **Step 3: Exercise the contracted team/mailbox features**

Verify only the mailbox, team-seat and shared-inbox capabilities included in the recorded plan. Prove a user outside Starpips cannot read or mutate its mailbox.

- [ ] **Step 4: Verify commercial and safety accounting**

Confirm sends count against the correct plan capacity; suppressed addresses and over-capacity sends fail closed; Mail usage and billing views are consistent and auditable.

- [ ] **Step 5: Record Starpips acceptance**

Record the exact release SHA, provider settlement identifier, test run IDs, domain readiness and customer-path results in the handoff. Do not include secrets or unnecessary personal data.

### Task 5: Verify Enterprise AI in Mkety's internal non-production system after Starpips acceptance

**Files:**
- Read/run: `scripts/stage-ai-commercial-fixture.ts`
- Read/run: `scripts/accept-mkety-ai-commercial.ts`
- Read/run: `.github/workflows/mkety-public-candidate-deploy.yml`
- Read/run: `.github/workflows/mkety-ai-commercial-acceptance.yml`
- Read/modify: focused Enterprise AI commercial/runtime tests under `src/features/ai-runtime/`
- Modify: `docs/handoffs/2026-09-29-mail-production-gateway-next.md`
- Modify: `docs/handoffs/2026-09-28-enterprise-ai-platform-mail-completion.md`

**Interfaces:**
- Consumes: successful Starpips Mail acceptance from Task 4 and the approved non-production AI acceptance environment.
- Produces: evidence that Mkety's Enterprise AI managed route runs, credits and budgets reserve/settle, provider costs are recorded, idempotent replay is blocked, tenant isolation holds, fixture cleanup restores the previous staging policy and production inference remains disabled.

- [ ] **Step 1: Verify Starpips acceptance is complete before starting**

Check the Task 4 handoff evidence and exact SHA. If any customer acceptance check is incomplete, do not run internal Enterprise AI acceptance.

- [ ] **Step 2: Verify isolated staging environment and cleanup guard**

Use the existing ephemeral fixture in `scripts/stage-ai-commercial-fixture.ts` and the prepared non-production endpoint/secret from the preview environment. Confirm fixture state path is unique and cleanup runs even after an acceptance failure. Never target production.

- [ ] **Step 3: Verify Enterprise AI acceptance and cleanup coverage**

Assert Enterprise AI requests use the intended managed model and immutable rate card, reserve and settle credits/budgets with verified provider costs, reject duplicate dispatch, and remain scoped to the ephemeral tenant. Assert cleanup restores the previous staging policy and deletes only the ephemeral fixture.

- [ ] **Step 4: Run the guarded Enterprise AI acceptance**

Run the existing public candidate workflow or its guarded setup/request/cleanup sequence against the non-production environment after Starpips acceptance passes. Verify successful managed inference, commercial ledger and usage records, provider-cost accounting and idempotent replay. Confirm cleanup ran and production `customerInferenceEnabled` remains false.

- [ ] **Step 5: Record post-customer test evidence**

Record the Enterprise AI acceptance run ID, exact SHA, non-production environment, managed model, settlement/accounting results, idempotency result, fixture cleanup and production inference state. Do not include secrets or Starpips data. Do not invoke the production inference promotion workflow from this internal acceptance.

### Task 6: Verify exact candidate and integrate safely

**Files:**
- Read: `.github/workflows/ci.yml` and relevant Mkety Mail workflows

**Interfaces:**
- Produces: tests, type-check, lint, build, migration and applicable Cloudflare/vinext results for one candidate SHA; a reviewable PR with no Assist files.

- [ ] **Step 1: Run focused Mail customer tests**

Run focused billing, Mail commercial, domain, gateway, sending-policy and Enterprise AI acceptance tests from Tasks 2–5.
Expected: settlement, isolation, delivery, usage, AI accounting and fixture cleanup assertions pass.

- [ ] **Step 2: Run repository verification**

Run: `pnpm test`, `pnpm type-check`, `pnpm lint`, `pnpm build`, `pnpm db:check:migrations`, plus applicable Cloudflare/vinext checks.
Expected: all required gates pass on the candidate SHA; no changes under `customer-apps/assist`.

- [ ] **Step 3: Integrate without dropping Mkety changes**

Before publishing, inspect the latest GitHub `main` and replay only Mkety changes onto it using a non-force update. Confirm existing payment-fix commits are preserved and no standalone Assist history or files are included. Open a reviewable PR and require exact-head checks.

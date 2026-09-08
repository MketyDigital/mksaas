# Mkety Wallet Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Wallet v1 as a tenant-scoped, read-only commercial/accounting balance surface derived from the existing Mkety Billing financial ledger, with exact bigint precision, per-currency balances, safe history, and a tenant-authorized API.

**Architecture:** Reuse `billing_ledger_entries` as the only financial source of truth. Add a pure Wallet balance engine, a narrow tenant-scoped read source, a Wallet service, and an API route following the existing Billing summary authorization/serialization pattern. Do not add a wallet table, second ledger, payment mutation path, FX layer, or coupling to product Usage/Credits.

**Tech Stack:** TypeScript 5.9, Next.js 16.2, vinext/Cloudflare Workers, Drizzle ORM/PostgreSQL, Jest, existing Mkety Auth and tenant-membership authorization.

**Spec:** `docs/superpowers/specs/2026-09-08-mkety-wallet-core-design.md`

## Global Constraints

- Base/default commercial currency is `USD`.
- Preserve all ledger currencies independently; never sum unlike currencies.
- No FX conversion or exchange-rate provider in Wallet v1.
- Persisted/authoritative money remains integer minor units mapped as JavaScript `bigint`.
- `Account Balance` is the tenant's net commercial position per currency.
- `Credit Balance = max(Account Balance, 0n)` and is commercial credit, not withdrawable cash.
- Billing financial ledger remains the only financial source of truth.
- Product Usage/Credits remains a separate domain and must not be included in Wallet financial totals.
- No `tenant_wallet_balances` table, Wallet mutation endpoint, deposits, withdrawals, transfers, or second financial ledger.
- Current Mkety session plus current database tenant membership is authoritative for API access.
- A persistence/query failure must fail; it must never be converted into a fabricated zero balance.
- No migration is expected. If existing Billing ledger data cannot reconstruct Wallet semantics safely, stop implementation and revise the approved design before adding schema.
- Preserve promotion order: Auth #16 → Webhooks #15 → Billing #21 → Entitlements #22 → Usage/Credits #23 → Wallet.

---

### Task 1: Build the pure Wallet financial balance engine

**Files:**
- Create: `src/features/wallet/types.ts`
- Create: `src/features/wallet/engine.ts`
- Create: `src/features/wallet/engine.test.ts`
- Reference: `src/features/billing/server/ledger-service.ts`

**Interfaces:**
- Consumes: Billing ledger concepts `LedgerEntryType`, `amountMinor: bigint`, `currency`, `reversalOfEntryId`.
- Produces:
  - `WalletLedgerEntry`
  - `WalletCurrencyBalance`
  - `normalizeWalletCurrency(currency: string): string`
  - `deriveWalletBalances(entries: readonly WalletLedgerEntry[]): WalletCurrencyBalance[]`
  - `deriveWalletBalance(entries: readonly WalletLedgerEntry[], currency: string): WalletCurrencyBalance`

- [ ] **Step 1: Write the Wallet domain types and failing engine tests**

Define the minimum read model in `types.ts`:

```ts
export type WalletLedgerEntryType =
  | 'charge'
  | 'payment'
  | 'credit'
  | 'debit'
  | 'waiver'
  | 'reversal';

export interface WalletLedgerEntry {
  id: string;
  entryType: WalletLedgerEntryType;
  amountMinor: bigint;
  currency: string;
  reversalOfEntryId: string | null;
  createdAt: Date;
  reference: string | null;
}

export interface WalletCurrencyBalance {
  currency: string;
  accountBalanceMinor: bigint;
  creditBalanceMinor: bigint;
}
```

Write tests covering:

```text
empty ledger -> USD 0/0
charge 10000 USD -> account -10000, credit 0
payment 10000 USD -> account +10000, credit +10000
credit 2500 USD -> account +2500, credit +2500
debit 2500 USD -> account -2500, credit 0
waiver 2500 USD -> account +2500, credit +2500
mixed sequence -> deterministic net result
USD and NGN -> independent balances
currency input is normalized to uppercase
very large bigint remains exact
negative account balance never produces negative credit balance
reversal of payment produces the exact opposite payment effect
reversal of charge produces the exact opposite charge effect
missing reversal target fails closed rather than guessing
reversal pointing to another reversal fails closed
```

Use actual compensating-entry behavior from `reverseLedgerEntry`: a reversal row stores `reversalOfEntryId` and a negated amount. Do not infer the reversal's economic meaning from its signed amount alone; resolve the original entry and negate the original entry's economic effect.

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```bash
pnpm test -- --runTestsByPath src/features/wallet/engine.test.ts
```

Expected: FAIL because Wallet engine/types do not yet exist or required behavior is unimplemented.

- [ ] **Step 3: Implement the minimal pure engine**

Implement one centralized effect model:

```text
charge  -> -abs(amount)
payment -> +abs(amount)
credit  -> +abs(amount)
debit   -> -abs(amount)
waiver  -> +abs(amount)
reversal -> -(economic effect of referenced original entry)
```

Rules:
- group by normalized three-letter currency;
- include default USD zero balance even with no entries;
- return other currencies only when ledger entries exist for them;
- never mutate input entries;
- preserve bigint arithmetic end-to-end;
- throw a domain error for malformed currency or unreconstructable reversal semantics.

- [ ] **Step 4: Run focused Wallet engine tests GREEN**

```bash
pnpm test -- --runTestsByPath src/features/wallet/engine.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the pure domain slice**

```bash
git add src/features/wallet/types.ts src/features/wallet/engine.ts src/features/wallet/engine.test.ts
git commit -m "feat: add Wallet balance engine"
```

---

### Task 2: Add the tenant-scoped Wallet read source

**Files:**
- Create: `src/features/wallet/server/source.ts`
- Create: `src/features/wallet/server/drizzle-source.ts`
- Create: `src/features/wallet/server/drizzle-source.test.ts`
- Reference: `src/features/billing/server/drizzle-queries.ts`
- Reference: `src/shared/db/schema/billing-ledger-entries.ts`

**Interfaces:**
- Consumes: `billingLedgerEntries` only; no Usage/Credits tables.
- Produces:

```ts
export interface WalletHistoryQuery {
  tenantId: string;
  currency?: string;
  entryType?: WalletLedgerEntryType;
  limit?: number;
}

export interface WalletSource {
  listLedgerEntriesForBalances(tenantId: string): Promise<WalletLedgerEntry[]>;
  listWalletHistory(input: WalletHistoryQuery): Promise<WalletLedgerEntry[]>;
}
```

- [ ] **Step 1: Write failing source tests**

Test the source contract for:

```text
all balance reads are filtered by tenantId
history reads are filtered by tenantId
optional currency filter is normalized/validated before query
optional entryType filter accepts only Wallet ledger types
history is newest-first
history limit is bounded to a safe range
selected columns contain no provider payload/secret fields
source imports Billing ledger schema, not credit-ledger/usage tables
```

Use the same query/test style already used by Billing Drizzle source tests rather than creating a new database abstraction.

- [ ] **Step 2: Run focused source tests RED**

```bash
pnpm test -- --runTestsByPath src/features/wallet/server/drizzle-source.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement the Wallet source**

`listLedgerEntriesForBalances(tenantId)` must select only:

```text
id
entryType
amountMinor
currency
reversalOfEntryId
createdAt
reference
```

from `billing_ledger_entries` where `tenant_id = tenantId`.

`listWalletHistory` must reuse the same safe projection, enforce tenant scope in the SQL predicate, support only the approved filters, order `createdAt DESC`, and enforce a bounded limit (default 50, maximum 100 unless existing repository conventions require a smaller bound).

Do not fetch settlement raw references, provider payloads, payment credentials, or Usage/Credits records.

- [ ] **Step 4: Run source tests GREEN**

```bash
pnpm test -- --runTestsByPath src/features/wallet/server/drizzle-source.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the source slice**

```bash
git add src/features/wallet/server/source.ts src/features/wallet/server/drizzle-source.ts src/features/wallet/server/drizzle-source.test.ts
git commit -m "feat: add Wallet ledger read source"
```

---

### Task 3: Build the Wallet service and preserve domain separation

**Files:**
- Create: `src/features/wallet/server/service.ts`
- Create: `src/features/wallet/server/service.test.ts`
- Reference: `src/features/usage-credits/server/service.ts`

**Interfaces:**
- Consumes: `WalletSource`, `deriveWalletBalances`, `deriveWalletBalance`.
- Produces:

```ts
getWalletSummary(tenantId: string): Promise<WalletSummary>
getWalletBalances(tenantId: string): Promise<WalletCurrencyBalance[]>
getWalletBalance(tenantId: string, currency: string): Promise<WalletCurrencyBalance>
getWalletHistory(tenantId: string, filters?: WalletHistoryFilters): Promise<WalletLedgerEntry[]>
```

`WalletSummary` must include:

```ts
export interface WalletSummary {
  baseCurrency: 'USD';
  balances: WalletCurrencyBalance[];
  recentHistory: WalletLedgerEntry[];
}
```

- [ ] **Step 1: Write failing service tests**

Cover:

```text
empty ledger returns USD zero summary, not null
additional currencies appear separately
getWalletBalance('usd') resolves USD
invalid currency rejects
source failure propagates and does not become zero
history delegates tenantId and safe filters
service has no setBalance/deposit/withdraw/transfer method
Wallet never calls getCreditBalance, consumeCredits, grantCredits, or product credit ledger APIs
Usage/Credits records cannot affect financial Wallet totals
```

- [ ] **Step 2: Run focused service tests RED**

```bash
pnpm test -- --runTestsByPath src/features/wallet/server/service.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement the Wallet service**

Use dependency injection like existing Billing/Usage service boundaries:

```ts
export function createWalletService(source: WalletSource) { ... }
```

Then expose lazy default Drizzle-backed functions from the same module, mirroring the established `usage-credits/server/service.ts` pattern without importing Usage/Credits itself.

For the summary, obtain ledger data for balances and a bounded recent history. Do not catch persistence exceptions merely to return zero.

- [ ] **Step 4: Run focused service tests GREEN**

```bash
pnpm test -- --runTestsByPath src/features/wallet/server/service.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the service slice**

```bash
git add src/features/wallet/server/service.ts src/features/wallet/server/service.test.ts
git commit -m "feat: add Wallet read service"
```

---

### Task 4: Add the tenant-authorized Wallet summary/history API

**Files:**
- Create: `src/app/api/tenants/[tenant]/wallet/summary/route.ts`
- Create: `src/app/api/tenants/[tenant]/wallet/summary/route.test.ts`
- Create: `src/app/api/tenants/[tenant]/wallet/history/route.ts`
- Create: `src/app/api/tenants/[tenant]/wallet/history/route.test.ts`
- Reference: `src/app/api/tenants/[tenant]/billing/summary/route.ts`

**Interfaces:**
- Consumes: current Mkety `auth(request)`, tenant lookup, current `tenantMemberships`, Wallet service.
- Produces:
  - `GET /api/tenants/[tenant]/wallet/summary`
  - `GET /api/tenants/[tenant]/wallet/history?currency=USD&entryType=payment&limit=50`

- [ ] **Step 1: Write summary-route tests RED**

Use the Billing summary dependency-injected handler pattern. Cover:

```text
no current user -> 401
current user without current DB membership -> 403
member -> 200
empty Wallet -> USD zero state
bigint values serialize as exact decimal strings
Date values serialize as ISO strings
response contains no provider secrets/raw gateway payloads
```

- [ ] **Step 2: Write history-route tests RED**

Cover:

```text
no current user -> 401
non-member -> 403
member -> 200
currency filter normalization
invalid currency -> 400
invalid entryType -> 400
invalid/unbounded limit -> 400 or normalized safe bound, consistently with implementation
bigint exact serialization
history contains only Wallet-safe ledger fields
```

- [ ] **Step 3: Run exact route tests RED**

Use exact test paths because the Billing work previously caught Jest silently skipping `[tenant]` paths when they were treated as patterns:

```bash
pnpm test -- --runTestsByPath \
  'src/app/api/tenants/[tenant]/wallet/summary/route.test.ts' \
  'src/app/api/tenants/[tenant]/wallet/history/route.test.ts'
```

Expected: FAIL.

- [ ] **Step 4: Implement summary route**

Follow the existing Billing route security contract:

```text
authenticate request
→ resolve tenant slug
→ query current DB tenant membership
→ call Wallet service with authoritative tenantId
→ recursively serialize bigint/Date safely
→ return private, no-store JSON
```

Do not accept a browser-supplied tenant ID as authorization proof.

- [ ] **Step 5: Implement history route**

Validate query parameters before calling the service. Keep filters small and explicit; no arbitrary sort/SQL-like filtering.

- [ ] **Step 6: Run route tests GREEN**

```bash
pnpm test -- --runTestsByPath \
  'src/app/api/tenants/[tenant]/wallet/summary/route.test.ts' \
  'src/app/api/tenants/[tenant]/wallet/history/route.test.ts'
```

Expected: PASS.

- [ ] **Step 7: Commit the API slice**

```bash
git add 'src/app/api/tenants/[tenant]/wallet' src/features/wallet
git commit -m "feat: expose tenant Wallet API"
```

---

### Task 5: Add minimum Wallet product surface without inventing money movement

**Files:**
- Inspect first: current tenant/project navigation and billing surfaces on `feat/mkety-wallet-core`.
- Create or modify only the smallest existing Mkety Platform billing/account route/component needed to expose Wallet summary.
- Test: colocated component test for the chosen surface.

**Interfaces:**
- Consumes: Wallet summary API/service read model.
- Produces: a read-only Platform Wallet surface showing per-currency `Account Balance` and `Credit Balance`, with USD first/default and clear non-withdrawable wording.

- [ ] **Step 1: Inspect the current account/billing navigation before choosing the route**

Do not create a second navigation pattern. Reuse the current Platform shell and existing Billing/Usage placement.

- [ ] **Step 2: Write a failing component test for the smallest Wallet surface**

Required UI assertions:

```text
heading identifies Wallet
USD is the default/base view
Account Balance is shown
Credit Balance is shown
additional currencies remain separate
copy does not call commercial credit "cash" or "withdrawable"
no Deposit, Withdraw, Send, Transfer, Cash out, or FX controls exist
empty state shows USD 0 rather than an error
```

- [ ] **Step 3: Run the focused component test RED**

Run the exact colocated test path chosen in Step 2.

- [ ] **Step 4: Implement the minimum read-only Wallet surface**

Use the existing Mkety visual system/components. Do not redesign the Platform shell and do not add payment-provider UI.

- [ ] **Step 5: Run the focused component test GREEN**

Expected: PASS.

- [ ] **Step 6: Commit the UI slice**

Commit only the inspected navigation/surface files and their tests with:

```bash
git commit -m "feat: add read-only Wallet surface"
```

---

### Task 6: Full Wallet verification, architecture checks, and handoff

**Files:**
- Create: `docs/HANDOFF_MKETY_WALLET_2026-09-08.md`
- Modify: `AGENTS.md` only if implementation status must be appended under the document's protected end marker; never edit/remove protected blueprint content.
- Do not create a migration unless the design was explicitly revised first.

**Interfaces:**
- Consumes: Tasks 1-5.
- Produces: one internally verified Wallet branch ready to open as a draft PR stacked on Usage/Credits #23.

- [ ] **Step 1: Run all focused Wallet tests**

```bash
pnpm test -- --runTestsByPath \
  src/features/wallet/engine.test.ts \
  src/features/wallet/server/drizzle-source.test.ts \
  src/features/wallet/server/service.test.ts \
  'src/app/api/tenants/[tenant]/wallet/summary/route.test.ts' \
  'src/app/api/tenants/[tenant]/wallet/history/route.test.ts'
```

Add the chosen Wallet UI test path from Task 5.

Expected: PASS.

- [ ] **Step 2: Run domain-separation regression checks**

Verify Wallet source/service files do not import:

```text
credit-ledger-entries
tenant-credit-accounts
usage-events
consumeCredits
grantCredits
recordUsage
```

except in tests whose purpose is explicitly to prove separation.

Verify no Wallet persistence table or migration was added.

- [ ] **Step 3: Run repository verification**

```bash
pnpm test
pnpm type-check
pnpm lint
pnpm db:check:migrations
pnpm exec drizzle-kit check
pnpx vinext check
pnpm build
pnpm run deploy --env preview --dry-run
```

If the exact migration-check script name differs on this branch, inspect `package.json`/current CI and use the existing authoritative migration guard; do not invent or bypass it.

Expected: all applicable checks PASS. Preview command is packaging/dry-run only unless the external Auth preview credentials have separately been configured and promotion has been authorized.

- [ ] **Step 4: Prove forward migration is unchanged**

Run the repository's guarded Drizzle forward-generation/no-op check used by Usage/Credits verification. Expected: no Wallet schema migration because Wallet v1 is read-only over the Billing ledger.

- [ ] **Step 5: Write the Wallet handoff**

Record:

```text
requested scope
existing Billing/Usage foundations reused
files/modules added
no database change
no environment/secret change
focused tests
full test count/result
type-check result
lint result
migration checks
vinext/build result
Cloudflare dry-run result
immutable verified SHA
known remaining issues
promotion dependency on #23 → #22 → #21 → #15 → #16
next recommended Platform batch
```

Do not claim real preview/production deployment if only dry-run packaging occurred.

- [ ] **Step 6: Update implementation status carefully**

If `AGENTS.md` needs a Wallet status note, append it only below the protected marker and use the status legend accurately (`IMPLEMENTED` / `VERIFIED`, not `PRODUCTION`). Do not rewrite the protected master blueprint.

- [ ] **Step 7: Commit verification/handoff docs**

```bash
git add docs/HANDOFF_MKETY_WALLET_2026-09-08.md AGENTS.md
git commit -m "docs: hand off Mkety Wallet core"
```

Only stage `AGENTS.md` if it actually changed.

- [ ] **Step 8: Open the Wallet draft PR**

Base the PR on `feat/mkety-usage-credits-core`, not `main`, while the prerequisite stack remains draft.

PR body must state:

```text
Wallet is read-only commercial/accounting balance presentation.
Billing ledger remains financial source of truth.
Product Usage/Credits remains separate.
No Wallet table or migration.
No stored-value cash, withdrawal, transfer, FX, or payment-provider mutation.
Internally verified but not promoted ahead of Auth/Webhooks/Billing/Entitlements/Usage.
```

Do not merge/promote the Wallet PR ahead of its prerequisite chain.

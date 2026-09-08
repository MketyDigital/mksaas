# Mkety Wallet Core Design

**Date:** 2026-09-08  
**Status:** Approved design  
**Branch:** `feat/mkety-wallet-core`  
**Base:** `feat/mkety-usage-credits-core`

## 1. Goal

Build Mkety Wallet v1 as a tenant-scoped, read-oriented commercial/accounting balance layer over the existing authoritative Billing financial ledger.

Wallet v1 must not introduce stored-value cash, customer withdrawals, provider-held balances, or a second financial ledger. It exists to give tenants a clear and safe view of their commercial position and available Mkety credit while preserving the existing Billing ledger as the single source of financial truth.

## 2. Position in the Platform Architecture

The relevant platform chain is:

```text
Billing Events / Settlements / Manual Adjustments
                    ↓
          Billing Financial Ledger
                    ↓
              Wallet Core
                    ↓
      Wallet Summary / History / API
```

Wallet is downstream of Billing. It does not replace Billing, settle payments, authorize gateway events, grant product entitlements, or consume product credits.

The relationship with the existing product-credit subsystem remains explicitly separate:

```text
Billing Financial Ledger → Wallet

Usage Events → Product Credit Ledger → Usage/Credits Balance
```

Money/accounting balances and product credits are different domains and must not be merged.

## 3. Core Architectural Decision

Wallet v1 will **derive balances from the existing Billing financial ledger at read time**.

No `tenant_wallet_balances` projection table will be introduced in this first slice.

Reasons:

- the Billing ledger already contains tenant, currency, exact bigint minor-unit amounts and append-oriented entries;
- direct aggregation keeps the ledger authoritative and prevents projection drift;
- current scale does not justify a second balance projection yet;
- no additional transaction-maintenance path is required;
- the design remains simple to verify and easy to evolve later if read volume proves a projection is necessary.

A cached/materialized balance projection may be introduced in a later explicitly approved design, but it must remain rebuildable from the financial ledger.

## 4. Currency Model

### 4.1 Base commercial currency

Mkety's default/base commercial currency is **USD**.

USD is the default presentation currency for global Mkety commercial surfaces unless a specific product or regional pricing rule explicitly says otherwise.

### 4.2 Multi-currency ledger behavior

Wallet remains technically multi-currency.

The authoritative currency recorded on each Billing ledger entry is preserved. Wallet must never silently combine currencies.

Examples of separate wallet positions:

```text
USD  $125.00
NGN  ₦48,000.00
EUR  €20.00
```

Wallet v1 must not calculate:

```text
USD + NGN + EUR = one synthetic balance
```

without an explicitly approved FX layer.

### 4.3 Location does not define authoritative currency

Customer location may influence checkout options, display preferences or future regional-pricing rules, but location alone must not determine the authoritative wallet currency.

### 4.4 No FX conversion in Wallet v1

Wallet v1 performs no automatic foreign-exchange conversion.

No exchange-rate provider, conversion table, conversion cache or FX accounting entries are part of this slice.

## 5. Existing Billing Ledger Contract

Wallet builds on the existing Billing ledger entry shape:

```ts
LedgerEntry {
  id
  tenantId
  subscriptionId
  billingPeriodId
  settlementId
  entryType
  amountMinor
  currency
  reversalOfEntryId
  reference
}
```

Existing entry types are:

- `charge`
- `payment`
- `credit`
- `debit`
- `waiver`
- `reversal`

All persisted money uses integer minor-unit semantics with JavaScript `bigint` mapping. Wallet must preserve this precision and must never introduce floating-point arithmetic for authoritative balances.

## 6. Balance Semantics

Wallet v1 exposes accounting/commercial position, not withdrawable stored money.

### 6.1 Entry effects

Wallet balance logic must use one explicit effect model:

- `payment` — improves the tenant's commercial position;
- `credit` — improves the tenant's commercial position;
- `charge` — worsens the tenant's commercial position / increases obligation;
- `debit` — worsens the tenant's commercial position;
- `waiver` — reduces an obligation but does not create withdrawable cash;
- `reversal` — applies the exact opposite economic effect of the original ledger entry through the existing compensating-entry model.

Implementation must use a tested normalization/effect function rather than scattering sign conventions through query code.

### 6.2 Account Balance

`Account Balance` is the tenant's net commercial position for a specific currency derived from the authoritative Billing ledger.

A positive value means the tenant has a commercial credit with Mkety. A negative value means the tenant has a net amount owed to Mkety. Zero means the tenant is commercially settled for that currency.

It answers:

> After authoritative charges, payments, credits, debits, waivers and reversals, what is this tenant's current commercial position with Mkety in this currency?

### 6.3 Credit Balance

`Credit Balance` is the positive portion of `Account Balance`:

```text
Credit Balance = max(Account Balance, 0)
```

It represents tenant commercial credit that can offset future Mkety charges.

It is not withdrawable customer cash.

A tenant who pays exactly a $100 charge has an Account Balance of $0 and a Credit Balance of $0, not a $100 cash wallet.

An overpayment or explicit commercial credit may produce a positive Account Balance and therefore a positive Credit Balance, but Wallet v1 must not describe that amount as withdrawable money.

### 6.4 Currency separation

Balances are always derived per currency.

A tenant may simultaneously have different commercial positions in USD, NGN or EUR. Wallet must return them as separate currency records.

## 7. Wallet Responsibilities

Wallet v1 is responsible for:

- deriving tenant balances from Billing financial ledger entries;
- deriving the tenant's default USD view;
- returning other currencies that actually exist in the tenant ledger;
- presenting account balance and credit balance clearly;
- exposing tenant-scoped wallet history;
- preserving exact bigint/minor-unit precision;
- enforcing server-side tenant authorization;
- keeping provider-specific data out of the public Wallet contract.

Wallet v1 is not responsible for:

- receiving payment-provider webhooks;
- creating settlements;
- charging payment methods;
- storing customer cash;
- withdrawals;
- transfers between tenants;
- peer-to-peer transfers;
- FX conversion;
- crypto asset custody;
- purchased product credits;
- product-credit consumption;
- entitlement authorization;
- invoice generation;
- provider account balances.

## 8. Service Boundary

Initial server API:

```ts
getWalletSummary(tenantId)
getWalletBalances(tenantId)
getWalletBalance(tenantId, currency)
getWalletHistory(tenantId, filters)
```

### 8.1 `getWalletSummary`

Returns a safe frontend-oriented summary containing:

- default/base currency: USD;
- USD balance state even when zero/empty;
- any additional currencies present in the tenant's ledger;
- account balance per currency;
- credit balance per currency;
- recent wallet history appropriate for the summary surface if the existing Billing query patterns make this cheap and clear.

### 8.2 `getWalletBalances`

Returns all derived tenant currency balances separately.

### 8.3 `getWalletBalance`

Returns one normalized currency balance for a tenant.

Currency input must be normalized and validated consistently with the existing Billing currency rules.

### 8.4 `getWalletHistory`

Returns tenant-scoped financial ledger history suitable for Wallet presentation.

Initial filters may include only what the existing schema supports safely, such as:

- currency;
- entry type;
- bounded pagination/date ordering if needed.

Do not invent unsupported filtering infrastructure solely for this slice.

## 9. Data Access

Wallet should use a small source/repository interface rather than embedding Drizzle queries into business logic.

Conceptually:

```ts
interface WalletSource {
  listLedgerEntriesForBalances(tenantId: string): Promise<LedgerEntry[]>;
  listWalletHistory(input: WalletHistoryQuery): Promise<LedgerEntry[]>;
}
```

The exact interface may be refined during implementation to allow database-side grouping/summing while keeping balance semantics testable in a pure function.

Preferred split:

```text
Drizzle query/source
      ↓
Pure wallet balance engine
      ↓
Wallet service
      ↓
Tenant-safe route/API
```

The pure engine should own entry-effect semantics and currency grouping so those rules can be exhaustively unit tested.

## 10. Authorization and Security

Wallet is server-authoritative.

Required rules:

- current Mkety session required for HTTP/API access;
- current database tenant membership required;
- every repository read is tenant-scoped;
- no cross-tenant history or balance aggregation;
- frontend calculations are never the authority for balances;
- Wallet exposes no raw payment-provider payloads;
- Wallet exposes no provider credentials, account secrets or webhook secrets;
- Wallet v1 has no direct `setBalance`, `deposit`, `withdraw`, `transfer` or arbitrary ledger mutation endpoint;
- monetary mutations continue through approved Billing settlement/manual-adjustment/ledger service paths.

Wallet read authorization should follow the existing Billing read boundary instead of inventing a new incompatible role system.

## 11. API Serialization

Authoritative money remains `bigint` internally.

JSON responses must serialize exact minor-unit amounts as strings or use the repository's existing safe Billing serialization convention.

Example concept:

```json
{
  "currency": "USD",
  "accountBalanceMinor": "12500",
  "creditBalanceMinor": "12500"
}
```

Do not convert persisted bigint values into unsafe JavaScript numbers.

UI formatting into `$125.00` is presentation logic and must not replace the exact authoritative minor-unit value.

## 12. Empty-State Behavior

A tenant with no financial ledger entries must still receive a valid Wallet summary.

Expected default:

```text
Base currency: USD
Account balance: 0
Credit balance: 0
Additional currencies: none
History: empty
```

An empty ledger is not an error.

## 13. Error Handling

Wallet read operations should fail safely for:

- unauthenticated access;
- unauthorized tenant membership;
- malformed/unsupported currency input;
- invalid history filters;
- persistence/query failures.

Wallet must not convert data-access failures into fabricated zero balances. Zero is valid only when authoritative data proves an empty/zero position.

Public errors should not leak SQL, provider references, internal secrets or cross-tenant identifiers.

## 14. Testing Strategy

Implementation must use TDD.

Required coverage:

### Pure balance engine

- empty ledger → USD zero state;
- charge semantics;
- payment semantics;
- credit semantics;
- debit semantics;
- waiver semantics;
- reversal semantics;
- mixed entry sequence produces deterministic result;
- multiple currencies remain independent;
- very large bigint values preserve exact precision;
- credit balance equals the positive portion of account balance;
- wallet credit balance does not imply withdrawable cash.

### Service/source

- tenant isolation;
- requested currency normalization;
- unknown/invalid currency rejection where applicable;
- history ordering;
- history filtering supported by the slice;
- persistence failure does not silently become zero;
- no mutation capability exists through Wallet service.

### HTTP/API boundary

- authenticated tenant member can read Wallet summary;
- unauthenticated request denied;
- non-member denied;
- exact bigint JSON serialization;
- no provider secrets/raw gateway data returned;
- USD appears as default/base view;
- additional currencies remain separate.

### Domain separation regression

- Wallet financial ledger entries are not product credit ledger entries;
- Usage/Credits balance is not included in Wallet money totals;
- Wallet does not call `consumeCredits` or grant product credits.

## 15. Persistence and Migration Decision

Wallet v1 should require **no new database table and no migration** if the existing Billing financial ledger and query indexes are sufficient.

During implementation, if a genuine persistence deficiency is discovered—for example, a required semantic cannot be reconstructed safely from the existing ledger—implementation must stop and the design must be upgraded before schema is added.

Do not add a wallet balance projection table merely for convenience.

## 16. Performance Boundary

Read-time ledger aggregation is intentionally accepted for Wallet v1.

If production evidence later shows that ledger aggregation is too expensive, a separate approved design may add a tenant/currency projection with these mandatory properties:

- derived from the Billing financial ledger;
- atomically maintained with ledger writes;
- rebuildable from ledger history;
- never treated as a competing source of truth;
- tenant/currency scoped;
- verified against ledger-derived totals.

No such projection is part of Wallet v1.

## 17. Alternatives Considered

### Alternative A — read-time ledger aggregation

**Selected.**

Pros:
- simplest source-of-truth model;
- no drift;
- no migration;
- small attack surface;
- easy to verify.

Cons:
- may become slower with very large ledgers.

This trade-off is acceptable for the current platform stage.

### Alternative B — `tenant_wallet_balances` projection table

Deferred.

Pros:
- faster reads.

Cons:
- concurrency and transaction complexity;
- projection drift risk;
- additional migration and reconciliation logic before needed.

### Alternative C — separate Wallet ledger

Rejected.

It would duplicate the existing Billing financial history and create competing financial truths.

## 18. Deferred Scope

Explicitly deferred from Wallet v1:

- real-money stored-value wallet;
- deposits as free wallet cash;
- withdrawals;
- tenant-to-tenant transfer;
- cash-out;
- crypto custody;
- FX conversion;
- exchange-rate providers;
- localized base-currency switching;
- wallet top-up products;
- purchased product-credit packs;
- overage billing;
- provider cost accounting;
- wallet balance projection table;
- external accounting-system synchronization;
- broad finance/admin UI beyond the minimum safe Wallet surface.

## 19. Success Criteria

Wallet v1 is complete when:

1. Mkety can derive exact tenant commercial/accounting balances from the existing financial ledger.
2. USD is the default/base commercial view.
3. Other currencies are preserved and displayed separately when present.
4. No automatic FX conversion occurs.
5. Account balance and commercial credit balance are unambiguous.
6. Product Credits remain a separate domain.
7. No direct Wallet mutation or stored-money capability is introduced.
8. All reads are tenant-authorized and provider-neutral.
9. bigint precision is preserved end to end.
10. Required tests, type-check, lint, build and existing verification gates pass.
11. No new migration is introduced unless the approved design is explicitly revised first.

## 20. Promotion / Stack Order

Wallet is stacked after Usage/Credits and must not bypass prerequisite Platform work.

```text
Auth #16
 ↓
Webhooks #15
 ↓
Billing #21
 ↓
Entitlements #22
 ↓
Usage/Credits #23
 ↓
Wallet
```

Wallet may be developed and internally verified while upstream PRs remain draft, but it must not be merged or promoted ahead of them.

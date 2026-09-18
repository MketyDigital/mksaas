# Mkety Wallet Read Model Design

**Status:** APPROVED FOR IMPLEMENTATION  
**Date:** 2026-09-18

## Objective

Add the first authenticated Mkety Wallet surface without creating stored value, cash movement, or a second financial ledger.

Wallet is a read-oriented commercial/accounting view over existing authoritative systems:

- Billing owns monetary truth, subscriptions, billing periods, settlements and immutable financial ledger entries.
- Usage/Credits owns non-monetary product-credit truth.
- Wallet composes those read models for the tenant.

## Hard boundaries

Wallet must not:

- store a new cash balance;
- allow withdrawal, transfer or peer-to-peer movement;
- perform FX conversion;
- write, duplicate or shadow Billing ledger entries;
- treat product credits as money;
- merge Usage/Credits with the Billing financial ledger;
- directly call payment providers.

## First slice

Route: `/t/{tenant}/wallet`.

Display:

1. current billing period amount due and currency;
2. plan/subscription state;
3. recent immutable Billing ledger activity;
4. recent verified/applied settlements;
5. product-credit balance, clearly labelled as non-cash.

No mutation controls are included.

## Architecture

`src/features/wallet/server/summary.ts` owns the provider-neutral read contract.

`src/features/wallet/server/drizzle-source.ts` reads through the Cloudflare database gateway and composes existing Billing and Usage/Credits truth.

The Wallet page uses the tenant ID resolved by the existing tenant layout/auth boundary.

No database migration is required.

## Balance semantics

The UI must not calculate a fake cash balance by summing Billing ledger rows. Billing entry types are domain events, and charges/payments are not a universal signed cash ledger convention. The first Wallet slice therefore presents authoritative period amounts and activity rather than inventing a stored-value balance.

## Verification

Required:

- unit tests for tenant scoping and separation of money vs product credits;
- full tests;
- type-check;
- lint;
- build;
- Vinext/Cloudflare smoke;
- existing migration baseline and workspace smoke;
- current handoff docs.

# NOWPayments integration playbook for Mkety products

Use this as the review and implementation checklist when adding or updating a NOWPayments flow in another Mkety product. This document does not change any other product. Keep each product's customer, order, credit, and ledger boundary independent.

## Checkout behavior

- Keep the product's order amount in its canonical fiat currency (USD for Assist). Do not replace the order price with an estimate in crypto.
- Fetch the current payment currency list from the authenticated NOWPayments API (`GET /v1/currencies`) and show the returned active currencies as network-specific choices. Treat tickers such as `USDTTRC20` and `USDTTON` as distinct payment methods.
- Prefer `USDTTON` as the default where it is in the current list; otherwise prefer `USDTTRC20`; otherwise select the first available currency. The customer can change it.
- Revalidate the selected ticker against a fresh provider list on the server immediately before creating the invoice. Never trust a browser-supplied ticker or amount.
- Create the invoice with the canonical fiat `price_amount` and `price_currency`, the selected `pay_currency` (when explicitly selected), `is_fixed_rate: true`, and `is_fee_paid_by_user: true`. If the currency list is unavailable, allow the provider-hosted checkout to present its own available choices instead of blocking checkout.
- Show the provider's final crypto quote and customer-paid fees before the customer confirms payment. Do not describe a fiat-denominated order as a fixed crypto amount; fixed rate locks the provider quote for that invoice.

## IDs and persistence

- Store the NOWPayments **invoice ID** and **payment ID** in separate fields. The invoice ID opens the hosted checkout; the payment ID is used for status verification and should appear in payment history and Ops.
- Persist the selected network, latest provider status, and provider-reported actual paid fiat value for investigation. Keep the product's own order reference as the join key.
- Backfill old rows only when the old field's meaning is proven from the old code path and row state. Do not overwrite a possible payment ID with an invoice ID based on assumptions.
- Use parameterized queries and keep all customer rows scoped by the authenticated account/workspace.

## Verification and crediting

- Treat browser redirects and customer-submitted IDs as lookup hints only. Verify status server-to-server with `GET /v1/payment/{payment_id}` and check the payment ID, product order reference, canonical price amount, and canonical price currency.
- Verify IPN signatures using the provider's documented signature method. A webhook is an input to verification, not permission to credit a different order or amount.
- Automatically grant the product's stored entitlement/credit only when the provider reports the exact terminal success state (`finished`) and all order checks pass.
- Keep `partially_paid`, `confirming`, `sending`, `waiting`, expired, and failed payments pending or failed; never grant automatically for them. If the product chooses to allow an Ops exception for a partial payment, make it an explicit, permission-checked action that re-queries NOWPayments, confirms reference and exact order quote, checks the documented received-value rule, records the provider evidence and operator identity, and settles idempotently.
- Make settlement idempotent with a unique settlement key and a conditional state transition. Ensure the entitlement/credit grant is driven by that one transition, not by both the webhook and browser return.
- Show payment ID, selected network, provider status, and customer payment reference in customer payment history where appropriate. Keep risk review and partial-approval controls Ops-only.

## Rollout and operating checks

1. Inspect existing invoice creation, webhook, verify, ledger, triggers, and migrations before editing. Confirm what existing provider ID fields actually contain.
2. Add tests for currency normalization/defaulting, server-side currency allowlisting, invoice fields, signature and order matching, each provider status, duplicate webhook/retry behavior, and one-time credit grant.
3. Test the migration against a copy or local D1 snapshot with pending, paid, and failed rows. Compare row counts and IDs before and after; never apply a speculative backfill to live data.
4. Deploy the additive schema change first if the product's deployment system requires it, then deploy code that reads/writes the new columns. Confirm migration completion before enabling checkout UI.
5. Use a low-value provider test transaction where possible; check customer history, Ops history, webhook logs, and ledger exactly once. Verify checkout remains usable if the currency-list endpoint times out.
6. Watch provider errors, incomplete payments, webhook retries, D1 writes, and support reports after rollout. Provide a rollback path that leaves payment history and already-settled ledger rows intact.

## Assist implementation decisions

Assist uses USD canonical order values. Its checkout now offers the current NOWPayments currency list, defaults to USDT on TON when available, enables fixed-rate quotes and customer-paid fees, stores invoice and payment IDs separately, and keeps provider verification and credit settlement server-side. Assist's Ops partial-payment review remains explicit and is never exposed to workspace owners or customers as a credit-grant control.

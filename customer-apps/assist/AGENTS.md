# Mkety Assist boundary

Mkety Assist is an independently deployable customer application inside the mksaas repository.

Hard rules:

- Do not import application code from the main Mkety Platform `src/` tree.
- Do not read or write the main Mkety Platform database.
- Do not depend on the main Enterprise AI tenant/workspace model.
- Shared Mkety capabilities are consumed through explicit APIs/events only.
- Mkety Payments may confirm payments; Assist owns its own credits, entitlements, usage ledger and commercial policy.
- Customer domains and the Operator surface are server-side only. Customers never receive Cloudflare credentials or Operator access.
- Every customer-scoped query must resolve a `customer_id` from an authenticated session and/or validated hostname, never from an untrusted request body alone.
- Assistant isolation always includes `customer_id + assistant_id`.
- Paid inference must fail closed when credit/rate/policy state cannot be verified.
- Telegram recovery can only use a Telegram identity that was linked while the account was already authenticated. Recovery must retain a non-Telegram fallback.

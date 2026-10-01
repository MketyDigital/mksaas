# Mkety Assist

Mkety Assist is the lightweight, Telegram-first AI assistant product. It lives in the `mksaas` repository for shared engineering/deployment conventions, but it is not a module of the main Mkety Platform or Main Enterprise AI.

## Product boundary

- Own Worker: `mkety-assist`
- Own D1: `mkety-assist-prod`
- Own migrations, sessions, customer records, credit ledger and model rates
- No imports from the root Mkety Platform `src/`
- No direct access to the main Mkety database
- Mkety Payments connects through a signed webhook/API contract
- Customer domains are managed only by Mkety Operator

## Hostnames

Default hosted customer URL:

```
<customer>.assist.mkety.app
```

Examples:

```
starpips.assist.mkety.app
company-b.assist.mkety.app
```

Customer-owned domain:

```
ai.starpipsforex.com
```

The customer adds only:

```
CNAME  ai  portal.assist.mkety.app
```

If Mkety manages that customer's DNS, Operator can perform the DNS change for them.

The Operator host is:

```
assist-ops.mkety.com
```

No Operator routes are intentionally exposed on customer hostnames.

Cloudflare for SaaS is used for customer custom hostnames. The Worker stores Cloudflare's custom-hostname ID and validation state in `customer_domains`.

## Authentication and Telegram recovery

Customer portal access uses a local session store in Assist.

A first owner gets a one-time setup link from Operator. Passwords are PBKDF2-derived and only the derived hash/salt are stored.

Telegram recovery is opt-in and cannot be attached during recovery:

1. User is already authenticated in the customer portal.
2. User selects **Connect Telegram**.
3. Assist creates a short-lived one-time linking token.
4. User opens the Mkety Assist auth bot via a `t.me/...?...start=link_<token>` deep link.
5. The auth-bot webhook binds that Telegram user ID to the already-authenticated Assist user.
6. Later, **Recover access with Telegram** can send a short-lived recovery code only to that pre-linked Telegram identity.

This avoids relying on Telegram's website Login Widget for every customer's custom hostname and works cleanly across many customer domains.

Email/operator recovery remains the break-glass fallback if a customer loses access to their Telegram account.

## Operator API

Operator is deliberately small. Initial endpoints:

- `POST /api/ops/customers` — create customer, hosted hostname, owner, commercial/feature defaults
- `GET /api/ops/customers` — customer list
- `POST /api/ops/domains` — create Cloudflare custom hostname
- `GET /api/ops/domains/status?hostname=...` — synchronize activation/TLS state
- `PATCH /api/ops/policy` — commercial and feature controls
- `GET /api/ops/models` — model route/rate visibility

Operator requests currently require `Authorization: Bearer <MKETY_ASSIST_OPS_TOKEN>`. Production should additionally place `assist-ops.mkety.com` behind Cloudflare Access.

## Customer API

Initial customer endpoints:

- `POST /api/auth/login`
- `POST /api/auth/setup`
- `POST /api/auth/logout`
- `POST /api/auth/telegram/link/start`
- `POST /api/auth/recovery/start`
- `POST /api/auth/recovery/verify`
- `GET /api/me`
- `GET|POST /api/assistants`
- `GET /api/usage`

The HTML shell is intentionally minimal; it proves the independent host/auth/control-plane path without copying the heavyweight Main Enterprise AI UI.

## Payment contract

Mkety Payments posts to:

```
https://portal.assist.mkety.app/api/payment/webhook
```

with a signed JSON body containing at least:

```json
{
  "id": "payment-event-id",
  "type": "payment.succeeded",
  "customerId": "cus_...",
  "amountMinor": 8000,
  "currency": "USD",
  "credits": 23280
}
```

Signature:

```
x-mkety-signature = hex(HMAC-SHA256(MKETY_ASSIST_PAYMENT_WEBHOOK_SECRET, raw_body))
```

Events are idempotent by provider event ID. Assist, not the main Mkety system, owns the resulting credit ledger.

## Required Worker secrets

- `MKETY_ASSIST_OPS_TOKEN`
- `MKETY_ASSIST_TELEGRAM_AUTH_BOT_TOKEN`
- `MKETY_ASSIST_TELEGRAM_AUTH_WEBHOOK_SECRET`
- `MKETY_ASSIST_CF_ZONE_ID`
- `MKETY_ASSIST_CF_SAAS_TOKEN`
- `MKETY_ASSIST_PAYMENT_WEBHOOK_SECRET`

Non-secret runtime value:

- `MKETY_ASSIST_TELEGRAM_AUTH_BOT_USERNAME`

The GitHub deployment workflow can reuse the repository's existing `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` to create/find the dedicated D1 database and deploy this Worker. The runtime Cloudflare-for-SaaS token should remain a dedicated scoped token when possible.

## Deploy

The deployment workflow:

1. verifies the isolated package;
2. finds or creates `mkety-assist-prod` D1;
3. injects the actual D1 UUID into a temporary Wrangler config;
4. applies Assist-only migrations;
5. uploads Assist-only Worker secrets;
6. deploys `mkety-assist`;
7. smoke-checks the Worker health endpoint.

The main Mkety build/deployment is not invoked.

## Current foundation vs next runtime layer

This foundation intentionally establishes the separation first: customer/domain routing, Operator control, independent commercial ledger, payment boundary, local auth and Telegram recovery.

The next Assist-specific layer is the generic Telegram assistant runtime: encrypted per-assistant bot tokens, webhook registration, conversation Durable Objects, Workers AI/model aliases, R2/Vectorize knowledge, media handling, reminders and credit admission/settlement. Those should be implemented here, not imported from Main Enterprise AI.

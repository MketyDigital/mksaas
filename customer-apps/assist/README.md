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

Mkety-owned SaaS routing topology:

```
customer domain
  CNAME -> mkety-assist.mkety.app
             CNAME -> assist-origin.mkety.app
                        -> exact Worker route to mkety-assist
```

The customer adds only:

```
CNAME  ai  mkety-assist.mkety.app
```

If Mkety manages that customer's DNS, Operator can perform the DNS change for them.

The Operator host is:

```
assist-ops.mkety.com
```

No Operator routes are intentionally exposed on customer hostnames.

Cloudflare for SaaS is used for customer custom hostnames. Assist follows the same operational topology as MkLMS: the provider-owned CNAME target is `mkety-assist.mkety.app`, its routing origin is `assist-origin.mkety.app`, and every external customer hostname receives an exact `<hostname>/* -> mkety-assist` Worker route. The Worker stores Cloudflare's custom-hostname ID and validation state in `customer_domains`.

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

## Operator

Operator is deliberately small. The internal console covers customers, commercial policy, feature entitlements, custom domains, model routes/rates, credits, health and audit history.

Key endpoints:

- `POST /api/ops/customers` — create customer, hosted hostname, owner, commercial/feature defaults
- `GET /api/ops/customers` — customer list
- `POST /api/ops/domains` — create Cloudflare custom hostname
- `GET /api/ops/domains/status?hostname=...` — synchronize activation/TLS state
- `PATCH /api/ops/policy` — commercial and feature controls
- `GET /api/ops/models` — model route/rate visibility
- `PATCH /api/ops/models/:alias` — publish route/rate changes
- `GET /api/ops/health` — lightweight operational health
- `GET /api/ops/audit` — recent audit activity

Operator requests currently require `Authorization: Bearer <MKETY_ASSIST_OPS_TOKEN>`. Production should additionally place `assist-ops.mkety.com` behind Cloudflare Access.

## Customer console and runtime

The customer console is a full private dashboard rather than the old StarAI browser-side database editor. It provides Dashboard, Assistants, Knowledge, Conversations, Human Handoff, Reminders, Usage & Credits, Team and Settings.

Each assistant independently owns its prompt version, Telegram connection, model alias, knowledge assignment, tools, memory switch and optional monthly credit cap.

Customer/runtime endpoints include:

- `POST /api/auth/login`
- `POST /api/auth/setup`
- `POST /api/auth/logout`
- `POST /api/auth/telegram/link/start`
- `POST /api/auth/recovery/start`
- `POST /api/auth/recovery/verify`
- `GET /api/me`
- `GET|POST /api/assistants`
- `GET|PATCH /api/assistants/:id`
- `POST|DELETE /api/assistants/:id/telegram`
- `PUT /api/assistants/:id/knowledge`
- assistant tool create/remove endpoints
- `GET|POST /api/knowledge` and knowledge-item upload
- `GET /api/conversations` and conversation messages
- `GET|POST|DELETE /api/reminders`
- human-handoff reply/resolve endpoints
- `GET /api/usage`
- `GET|POST|PATCH /api/team...`
- `GET|PATCH /api/settings`

Runtime behavior includes authenticated/idempotent Telegram ingress, real image download + Workers AI vision, real voice/audio download + Whisper transcription, R2 media storage, assistant-specific prompt/history/knowledge context, optional HTTPS tools, human escalation, scheduled Telegram reminders, stable Mkety model aliases and fail-closed credit reservation/settlement.

Knowledge uploads are stored in R2. Plain-text formats are ingested directly; supported rich documents such as PDF/Office/image formats are converted to text through the Workers AI Markdown Conversion binding before retrieval. If conversion fails, the item remains stored with conversion-error metadata rather than silently pretending it is searchable.

## Payment contract

Mkety Payments posts to:

```
https://mkety-assist.mkety.app/api/payment/webhook
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
- `MKETY_ASSIST_SECRET_ENCRYPTION_KEY` (or the shared stable `MKETY_CONNECTION_SECRET_ENCRYPTION_KEY` as deployment fallback)

Non-secret runtime value:

- `MKETY_ASSIST_TELEGRAM_AUTH_BOT_USERNAME`

The GitHub deployment workflow can reuse the repository's existing `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` to create/find the dedicated D1 database and deploy this Worker. The runtime Cloudflare-for-SaaS token should remain a dedicated scoped token when possible.

## Deploy

The deployment workflow:

1. verifies the isolated package and runs its dedicated type-check/Wrangler dry-run;
2. finds or creates `mkety-assist-prod` D1;
3. ensures the Assist R2 media bucket and provider-owned DNS topology;
4. injects the actual D1 UUID into a temporary Wrangler config;
5. applies Assist-only migrations;
6. uploads Assist-only Worker secrets;
7. deploys `mkety-assist`;
8. configures the optional Telegram recovery bot automatically when its token is present;
9. smoke-checks the Worker health endpoint.

The main Mkety build/deployment is not invoked.

## Deliberate Lite choices

Assist keeps the behaviors customers need without copying Main Enterprise AI's large tenancy/routing/control-plane architecture. D1 is authoritative, R2 stores files/media, Workers AI handles inference/vision/transcription/document conversion, and a one-minute Worker cron delivers reminders. Retrieval is intentionally local/textual at this stage rather than requiring a separate vector service for every customer. The schema and assistant boundary allow a Vectorize-backed retrieval adapter later without changing customer-facing behavior.

The product remains fail-closed for paid inference: an unavailable rate/route or failed credit reservation prevents a provider call. Provider costs, envelopes, reserves and model internals remain Operator-only.

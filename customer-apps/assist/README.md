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
4. If the customer has a connected assistant bot, Assist prefers that bot and opens `t.me/<customer-bot>?start=link_<token>`.
5. That assistant webhook binds the Telegram user ID only to the already-authenticated Assist user/challenge.
6. If the customer has no assistant bot yet, an optional central Mkety Assist recovery bot can be used as a fallback.
7. Later, **Recover access with Telegram** sends the short-lived recovery code through the same pre-linked Telegram recovery identity.

This avoids requiring a separate recovery bot per customer and avoids Telegram website-login configuration across every custom hostname.

Operator recovery remains the break-glass fallback if a customer loses access to Telegram.

## Operator

Operator is deliberately small. The internal console covers customers, commercial policy, feature entitlements, custom domains, model routes/rates, credits, health and audit history.

Key endpoints:

- `POST /api/ops/customers` — create customer, hosted hostname, owner, commercial/feature defaults
- `GET /api/ops/customers` — customer list
- `POST /api/ops/domains` — create Cloudflare custom hostname
- `GET /api/ops/domains/status?hostname=...` — synchronize activation/TLS state
- `PATCH /api/ops/policy` — commercial and feature controls
- `POST /api/ops/pricing/calculate` — deterministic envelope/reserve/multiplier credit calculation
- `GET /api/ops/models` — model route/rate visibility
- `PATCH /api/ops/models/:alias` — publish versioned route/rate changes and fallbacks
- `GET|POST|PATCH /api/ops/providers...` — encrypted external provider connections
- `POST /api/ops/credits` — audited funding/credit adjustment
- `GET /api/ops/ledger` — customer funding/credit history
- `GET /api/ops/health` — lightweight operational health
- `GET /api/ops/audit` — recent audit activity

Operator uses its own local secure session. On the first production deployment, if no Operator account exists, the deploy workflow creates a one-time setup token and writes the setup link to the private GitHub Actions job summary. The token is stored only as a hash in D1 and expires after 24 hours. Cloudflare Access may still be added as an outer defense layer, but it is not required for the Lite app to authenticate correctly.

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

Runtime behavior includes authenticated/idempotent Telegram ingress, real image download + Workers AI vision, real voice/audio download + Whisper transcription, R2 media storage, assistant-specific prompt/history/knowledge context, optional HTTPS tools, human escalation, scheduled Telegram reminders, stable Mkety model aliases and fail-closed commercial admission/credit reservation/settlement.

Stable customer-facing model aliases are `mkety-fast`, `mkety-smart`, `mkety-reasoning` and `mkety-vision`. Operator may route them through Workers AI, Mkety-managed infrastructure, OpenAI, Anthropic, Gemini, Azure OpenAI or an OpenAI-compatible endpoint. External provider credentials are encrypted at rest and never returned to the browser. A route may also have an independently configured fallback provider/model.

Provider-cost snapshots are versioned with the sell-rate cards. Runtime accounting includes text, image and audio usage. The customer rate multiplier is applied to base credit rates, while provider spend is checked against the customer monthly provider envelope minus operations reserve before paid inference when hard-stop is enabled.

Knowledge uploads are stored in R2. Plain-text formats are ingested directly; supported rich documents such as PDF/Office/image formats are converted to text through the Workers AI Markdown Conversion binding before retrieval. If conversion fails, the item remains stored with conversion-error metadata rather than silently pretending it is searchable.

## Payment contract

Assist uses the existing **Mkety Shared Payments** boundary instead of holding payment-provider credentials.

Top-up flow:

1. Assist creates a pending local `payment_checkouts` row with the authoritative credit amount and USD value.
2. Assist calls `POST https://mkety.com/api/payments/flutterwave/start` as source `assist`, authenticated by the existing `FLUTTERWAVE_CHECKOUT_BROKER_SECRET`.
3. Main Mkety creates the hosted Flutterwave checkout.
4. Main Mkety receives the provider webhook, validates the Flutterwave signature, re-queries the transaction and checks reference/amount/currency.
5. Main Mkety forwards the unchanged verified webhook to:
   ```
   https://mkety-assist.mkety.app/api/payment/flutterwave/webhook
   ```
   with an internal `x-mkety-payment-attestation` signed using the same broker secret.
6. Assist verifies the attestation and the stored quote, then moves its checkout from `pending` to `paid`.
7. A D1 trigger atomically grants the stored credits exactly once.

Browser return from Flutterwave is informational only and never grants credits.

## Required Worker secrets

Required:
- `MKETY_ASSIST_OPS_TOKEN`
- `MKETY_ASSIST_CF_ZONE_ID`
- `MKETY_ASSIST_CF_SAAS_TOKEN` (deployment can fall back to the scoped repository Cloudflare token)
- `MKETY_ASSIST_PAYMENT_WEBHOOK_SECRET`
- `MKETY_ASSIST_SECRET_ENCRYPTION_KEY` (deployment may use the existing stable `MKETY_CONNECTION_SECRET_ENCRYPTION_KEY` as fallback)

Optional central Telegram-recovery fallback:
- `MKETY_ASSIST_TELEGRAM_AUTH_BOT_TOKEN`
- `MKETY_ASSIST_TELEGRAM_AUTH_WEBHOOK_SECRET`
- `MKETY_ASSIST_TELEGRAM_AUTH_BOT_USERNAME`

Customer-assistant bot recovery works without the optional central recovery bot once a customer has connected an assistant bot.

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

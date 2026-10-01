# Enterprise AI commercial controls and first-customer provisioning

Date: 2026-09-30
Status: implementation on PR #227; production customer inference remains gated until controlled customer acceptance.

## Customer-visible contract

Enterprise AI customers should see only the product/commercial facts they need:

- monthly recurring price and any verified top-up/deposit amount;
- current Mkety credit balance and usage history;
- included capabilities/channels;
- simple Mkety model labels/tier and, when useful, the resulting Mkety credit rate such as credits per million input/output tokens;
- subscription/payment status;
- their assistants, channels, API keys, branding, hostname and operational logs.

Customers must not see or infer Mkety provider cost, gross-margin policy, managed provider-cost envelope, operations/safety reserve, internal rate multiplier, provider-cost snapshots, or the internal credit-unit conversion. Those are confidential Platform Control data and must stay out of customer APIs, invoices, exports, white-label pages and ordinary usage screens.

## Internal pricing model

Each Enterprise AI contract version stores the internal commercial inputs used to derive the allowance:

- monthly customer amount;
- managed provider-cost envelope percentage;
- operations/safety reserve percentage;
- customer usage-rate multiplier;
- internal credit-unit value;
- resulting included credits;
- capabilities and funding policy.

The internal calculator is server-authoritative. Browser values are not trusted to grant value.

For the initial defaults:

- managed provider-cost envelope: 15%;
- operations/safety reserve: 10%;
- customer usage-rate multiplier: 100% by default; increase only for explicitly approved contract pricing;
- internal credit unit: 1,000 USD micros.

Example for a USD 70 monthly contract:

1. provider-cost ceiling = USD 70 × 15% = USD 10.50;
2. reserve 10% internally, leaving USD 9.45 provider-cost capacity allocated to ordinary usage;
3. apply the default 1× Mkety usage-rate multiplier, producing USD 9.45 equivalent customer usage value;
4. at the internal 1,000-micro credit unit, grant 9,450 included credits.

Only USD 70/month and 9,450 credits are customer-facing. The provider-cost ceiling remains independently enforced against real provider spend.

## Provider cost and Mkety model rates

Provider cost belongs to the managed model record and must include a verification date before an external managed route is enabled. A Platform Control operator can generate a new draft Mkety rate-card version from the verified provider-cost snapshot plus the internal multiplier.

Example at 2×:

- provider input USD 0.15/M → Mkety rate 300 credits/M input;
- provider output USD 0.50/M → Mkety rate 1,000 credits/M output.

The generated rate card starts as draft. Activation is explicit and retires the previous active version; historical billable usage remains tied to its original version.

Provider pricing changes should create a new verified snapshot and a new proposed rate version. They must not rewrite historical rates. Automated provider-price discovery may propose values, but activation remains an explicit Platform Control action.

## Manual bonus / goodwill credits

Platform Control Billing & Ledger supports a zero-dollar manual credit grant. It uses the shared immutable Usage/Credits ledger with:

- target tenant;
- positive credit amount;
- reason;
- actor identity;
- idempotency key;
- entry type `manual_grant`.

A manual grant does not create a settlement, payment, invoice, subscription renewal or cash balance. Use it for goodwill, service recovery, controlled testing or extending a customer through the remainder of a billing period. Paid top-ups remain separate purchased/funding flows.

## First customer: USD 70/month

Recommended initial contract:

- monthly price: USD 70;
- full monthly payment;
- setup fee: USD 0 unless separately agreed;
- automatic included-credit calculation;
- internal defaults: 15% provider-cost ceiling, 10% reserve, 1× usage-rate multiplier;
- expected included credits with those defaults: 9,450;
- base Enterprise AI entitlement;
- white-label;
- managed/custom hostname;
- Website;
- Telegram;
- API;
- additional channels may be entitled now but configured only when production-ready;
- BYOK/private-model capability may be granted if commercially intended, but it is not required merely because Mkety uses Azure/Workers/OpenAI internally.

Multiple Telegram bots/accounts should be modeled as multiple tenant-owned channel connections bound to one or more solution instances, not as separate product entitlements per bot. Website, Telegram and API can share the same tenant credit pool unless a future sub-budget is intentionally configured.

## Provider and model administration

Managed model/provider configuration is mutable without application rebuild:

- provider connection/secret rotation is encrypted and confirmed;
- model/provider cost metadata is database-backed;
- Mkety aliases decouple customer-facing model selection from the underlying provider;
- draft rate cards can be derived from provider costs;
- rate-card activation/retirement is explicit and versioned;
- public/system provider routing is separately controlled from tenant BYOK;
- self-hosted OpenAI-compatible endpoints can participate through the same managed model abstraction.

Azure OpenAI / Microsoft Foundry resource endpoints should be stored at the resource host root where the adapter appends the Responses API path; the deployment name is stored separately.

## Safety and acceptance

Customer inference stays fail-closed until the first controlled customer acceptance passes commercial settlement, tenant isolation, provider/model route, credit/accounting, white-label hostname/login, channel binding, API, operator handoff and run-log verification.

Mail onboarding follows only after Enterprise AI acceptance. Mkety Mail should first power controlled Mkety system email, then ZITADEL auth email, before the first external Mail customer is accepted.

## Channel multimodal inputs

Telegram channel connections support inbound photo/image messages and voice/audio notes. Mkety verifies the Telegram webhook, resolves the provider file server-side with the encrypted bot token, enforces media count/size/type/duration limits, then performs managed preprocessing before the normal Enterprise AI turn:

- images are converted to bounded visual context with a managed Workers AI vision model;
- voice/audio is transcribed with managed Workers AI speech recognition;
- the resulting context stays inside the same tenant conversation and credit/admission boundary;
- media preprocessing provider cost is added to Mkety's internal provider-cost envelope and audit metadata, while customers continue to see normal credits/usage rather than provider-cost internals;
- provider-capacity retries reuse the already-derived text context so Mkety does not intentionally reprocess the media on a retry.

Other channels expose multimodal badges only after their inbound adapter actually implements equivalent media verification and download rules. Do not claim image/audio support from a channel merely because the underlying AI model is multimodal.

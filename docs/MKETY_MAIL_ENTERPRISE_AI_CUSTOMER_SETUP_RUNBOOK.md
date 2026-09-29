# 2026-09-29 final customer-readiness update

This section is authoritative over older production-state notes below.

## Production state before customer onboarding

- Enterprise AI infrastructure is production-accepted by run `36568179070`; customer inference remains deliberately OFF until controlled customer acceptance.
- Mkety Mail application/runtime is production-accepted on exact main `f581b31443f255bbf8786d873562a390ee6698b3` by run `36639931406`.
- The dedicated Mail gateway is deployed, configured and healthy in Coolify/OCI with trusted TLS material and protected central Mkety APIs. Cloudflare authoritative/public DNS is correct.
- Public raw TCP 993/465 is still blocked upstream at OCI/provider ingress. External-client UI therefore remains OFF until public protocol acceptance and app-password functional acceptance pass.

## Enterprise AI: what Mkety configures vs what the customer can do

**Mkety/Platform operator must do once for a negotiated customer:**
1. ensure the customer has a Mkety tenant/account and appropriate owner/admin membership;
2. create the tenant-specific Enterprise AI contract version with negotiated monthly USD price, included credits and included capabilities. The contract builder always includes the base `workspace.ai.enterprise` entitlement and may add approved channel/API/white-label entitlements;
3. leave the subscription in billing authority—do not manually grant paid service from a browser claim;
4. if the commercial deal includes custom white-label/channel/API capabilities, include those entitlements in the active contract version;
5. keep global customer inference OFF until the platform/customer acceptance is complete.

**Customer flow after the contract exists:**
1. the tenant’s Enterprise AI page displays the negotiated agreement and **Pay & activate Enterprise AI**;
2. the customer selects an enabled payment method and completes checkout;
3. Mkety waits for verified provider settlement. Only server-side Billing settlement/subscription state activates the plan entitlement and included credits; the browser redirect itself cannot grant access;
4. once entitled, the customer can enter the Enterprise AI console and self-configure solution instances, instructions, approved knowledge, managed model/BYOK where entitled, channel connections, branding/white-label, managed/custom hostname, reply pacing/reminders, playground/tests, operator handoff, runs/logs, usage/credits and billing views;
5. renewal/past-due/grace rules remain server-authoritative. When the paid/grace period ends, inference fails closed while configuration/history is preserved, and valid renewal restores service without rebuilding the assistant.

**Managed service option:** Mkety can perform all of the customer setup on the customer’s behalf (solutions, channels, branding, domain and acceptance). The architecture does not require that; after verified payment and entitlement, the intended normal path is customer self-service with Mkety/Admin retaining commercial, routing, emergency-kill-switch and audit controls.

## Customer custom domains / Cloudflare-for-SaaS behavior

A customer domain may be hosted in another Cloudflare account or any other DNS provider. The customer only needs to publish the DNS ownership/routing records Mkety instructs them to add. Mkety’s domain acceptance must treat real route/HTTPS proof as authoritative when the customer hostname is demonstrably serving the expected Mkety tenant, rather than remaining blocked forever solely because a Cloudflare-for-SaaS dashboard SSL status is stale/pending. Provider state is still recorded for diagnostics and genuine routing/TLS failures remain fail-closed.

## Remaining launch order

1. close OCI raw-TCP ingress for Mail 993/465;
2. pass Mail gateway public TLS/protocol acceptance;
3. pass controlled app-password login/sync/send/revoke acceptance and only then enable external-client UI;
4. run the first Enterprise AI tenant through contract -> verified settlement -> entitlement/credits -> solution/channel/domain/playground/accounting acceptance while inference remains OFF;
5. deliberately enable Enterprise AI customer inference;
6. then onboard Starpips and subsequent real customers.

---

# Mkety Mail and Enterprise AI — customer setup and readiness runbook

Date: 2026-09-29
Status: pre-Starpips stabilization; production customer inference remains disabled until explicit promotion.

## 2026-09-29 production audit update

Current audited release truth:

- stabilization PR #173 is merged;
- guarded release SHA `3c1d5eb2f8b1312b02ea733ba053fa9b6e684104` executed Mkety Enterprise AI Production run `36568179070` successfully;
- that Enterprise AI run completed exact-SHA authorization, production database migration, AI delivery Queue/DLQ provisioning, production application deploy, `mkety-ai-delivery` worker deploy, internal-secret synchronization, `ai.mkety.com` / `api.mkety.com` domain attachment, and fail-closed production smoke;
- production customer inference was not enabled by that workflow and remains intentionally OFF pending real-customer acceptance;
- the same production database migration applied the repository schema on the guarded release SHA, so the Mail/AI stabilization migrations are present in production;
- Mkety Mail Production run `36568179379` stopped in authorization before any Mail deployment or infrastructure mutation. Migration proof inheritance passed; Cloudflare-smoke proof inheritance was rejected because the combined Mail/AI release also touched the AI production workflow/docs;
- PR #175 fixed only that neutral proof-chain classification and merged as `50a41b0695f6ff4204250676d25d40befaa356fc`;
- exact-main CI on `50a41b06…` is green for tests, type-check, build and lint;
- this runbook-only release marker exists to re-run the guarded Mail production workflow without invalidating infrastructure/migration proof.

This section supersedes older pre-production statements below where they conflict with the audited production state.

## 2026-09-29 Mail production acceptance update

- Production main `455a1359cbde16d9eae34b6683c19cb4088d481e` passed Mkety Mail Production run `36576563773`.
- Production DB migration, R2/Queues, Mail ingress/dispatch/events/content workers, central app deployment/auth bindings, Mail application domains and production smoke are accepted.
- The external-client TCP gateway remains separate: latest diagnostic `36574979021` found trusted TLS unavailable on `imap.mkety.com:993` and `smtp.mkety.com:465`.
- Active gateway work is documented in `docs/handoffs/2026-09-29-mail-production-gateway-next.md`.
- `MKETY_MAIL_EXTERNAL_CLIENTS_ENABLED` remains false until controlled real app-password acceptance.

## Product boundary: AI Workspace vs Enterprise AI

AI Workspace and Enterprise AI are distinct products that share Mkety infrastructure but do not share entitlement by accident.

### AI Workspace
- normal self-service Mkety workspace;
- intended for users building and using agents/AI inside their Mkety tenant;
- normal workspace navigation and projects;
- normal AI Workspace billing/entitlement;
- does not grant Enterprise AI.

### Enterprise AI
- separately entitled commercial product/add-on;
- focused customer-facing console at `ai.mkety.com`;
- branded assistants and customer experiences;
- production channels such as Website, Telegram, WhatsApp, Instagram, Messenger, Slack, Discord, LinkedIn Page Community, Teams outbound workflow/webhook, and custom webhook/API according to the verified channel contract;
- custom/managed hostname and white-label branding;
- Enterprise API/PaaS access where entitled;
- operator/human handoff and conversation operations;
- contracted limits, prepaid usage, budgets, audit/accounting, higher security controls and custom integrations;
- does not become active merely because the tenant has AI Workspace.

A tenant may own both. Shared identity, PBAC, Billing, Entitlements, Usage/Credits and AI runtime are platform primitives, not a reason to merge their UI, plans or customer entitlements.

## Enterprise AI commercial lifecycle

The target commercial lifecycle is:

1. Mkety creates/activates an Enterprise AI contract or recurring subscription for the tenant.
2. The active plan version grants `workspace.ai.enterprise` and any separately purchased channel/API/white-label entitlements.
3. Included/prepaid usage or purchased credits are available.
4. Before every billable request, Mkety checks:
   - active/grace-valid subscription entitlement;
   - product/channel/API entitlement;
   - production inference gate;
   - active route/model and rate card;
   - credits and hard budgets.
5. Paid provider work is admitted only after the commercial reservation succeeds.
6. Actual usage is settled after provider execution; provider cost and customer charge remain distinct.
7. If recurring payment becomes past due, access can continue only through an explicit unexpired grace period.
8. When grace/paid period ends, AI inference fails closed. Assistant configuration, knowledge, branding, channel credentials and history remain preserved.
9. Valid renewal/payment restores access without rebuilding the assistant.
10. Capacity/usage add-ons are additive and never replace the base Enterprise AI contract.

One-off Enterprise quotes/deposits/milestones remain Enterprise Payments transactions. They must not automatically become indefinite product entitlements.

## Enterprise AI customer capability checklist

### Customer-visible/configurable
- Enterprise AI overview and solution templates;
- solution instances;
- assistant name/status;
- system instructions;
- approved solution knowledge;
- managed model choice;
- global pause without deleting configuration;
- channel connections and encrypted credentials;
- per-channel solution binding;
- Website/Telegram and other entitled channel configuration;
- white-label name/logo/favicon/colors/support/legal configuration;
- managed `*.mkety.app` or approved customer hostname;
- provider/BYOK controls where entitled;
- plan/subscription summary;
- credits, usage and cost visibility;
- API/developer entry points where entitled;
- request/runs/log visibility;
- test/playground path;
- conversation history and human handoff/operator controls.

### Platform/Admin
- inference emergency kill switch;
- model/routing readiness;
- rate-card versions;
- provider-cost verification metadata;
- commercial limits and reservation policy;
- Enterprise contract/subscription state;
- tenant/channel/white-label entitlement assignment;
- usage/accounting/reconciliation;
- hostname/domain acceptance;
- audit/security visibility.

### Must remain protected
- provider secrets after save;
- raw platform credentials;
- customer cross-tenant data;
- direct historical rate or settlement mutation;
- production inference enablement without guarded promotion;
- entitlement creation based only on browser/client claims.

## Enterprise AI remaining implementation before first real customer

The following are required before Starpips acceptance starts:

- [x] distinct Enterprise AI entitlement and product shell;
- [x] central commercial admission and exact settlement;
- [x] managed model routes/rate cards/provider-cost evidence;
- [x] channel registry and authenticated ingress/outbound adapters;
- [x] white-label/domain foundation;
- [x] Enterprise AI console shell;
- [x] solution-level editable instructions/knowledge/model/pause UI;
- [x] bind channel connections to a selected solution instance;
- [x] make channel runtime consume selected solution instructions/knowledge/model/pause;
- [x] count injected instruction/knowledge context in reservation/accounting;
- [x] add deterministic customer test/playground for a selected solution;
- [x] expose customer-safe request/run logs;
- [x] persist conversations/messages;
- [x] implement per-conversation human takeover / resume rather than conflating it with global pause;
- [x] add configurable deterministic reply pacing backed by durable scheduled delivery rather than in-request sleeps;
- [x] add explicit future-commitment reminders with source-quote/date validation, idempotency, cancellation, retries and delivery-time entitlement checks;
- [x] connect recurring Enterprise AI contract/subscription lifecycle directly to product entitlement;
- [x] add tenant-specific versioned Enterprise AI contract pricing, included entitlements and billing-period credits;
- [x] execute guarded `mkety-ai-production.yml` on exact release SHA `3c1d5eb2f8b1312b02ea733ba053fa9b6e684104` and verify `ai.mkety.com` (run `36568179070`);
- [x] verify `api.mkety.com/v1/ai` through the production host with fail-closed unauthenticated smoke (run `36568179070`);
- [x] provision and verify `mkety-ai-delivery` Queue/DLQ and scheduler worker (run `36568179070`);
- [x] pre-merge implementation exact-head CI/candidate acceptance on `5e85c2331208d5c49380cec77683c352e8fcf2ad` (CI `36563958996`, migration `36563959225`, vinext `36563959181`, workspace smoke `36563959122`, public candidate `36563959073`);
- [x] production product-host/infrastructure acceptance on release SHA `3c1d5eb2f8b1312b02ea733ba053fa9b6e684104`;
- [ ] only then begin a real customer acceptance;
- [ ] only after that intentionally enable production customer inference.

## Stabilization certification note

Pre-merge implementation certification is closed on code SHA `5e85c2331208d5c49380cec77683c352e8fcf2ad`. The final documentation-only reconciliation head still receives normal CI before merge, but it does not reopen the already-passed staging commercial/runtime acceptance unless executable behavior changes.

Production Enterprise AI inference remains OFF. No Starpips acceptance has started. Guarded production deployment, `ai.mkety.com` / `api.mkety.com/v1/ai` host verification, and delivery Queue/DLQ/scheduler verification are now complete on run `36568179070`. The next Enterprise AI step is controlled real-customer acceptance; inference must remain OFF until that acceptance passes.

## Mkety Mail product model

Mkety Mail is one product with two entry points:
- focused app: `mail.mkety.com`;
- native tenant entry: `/t/{tenant}/mail`.

It reuses central Mkety identity, tenant membership, roles/PBAC, Billing and Entitlements. Customers do not create a second Mkety identity.

## Mkety Mail customer capabilities

### Core business email
- connect and verify sending/receiving domain;
- managed Mail DNS/onboarding guidance;
- create mailboxes;
- aliases and forwarding;
- inbox/thread/message experience;
- shared inboxes;
- mailbox/team access;
- message and attachment storage;
- app passwords for external mail clients.

### Customer/productivity
- contacts;
- templates;
- Customer Updates for allowed operational/customer communications;
- suppression management;
- delivery analytics/events;
- shared-inbox assignment/notes;
- automation rules where enabled.

### Developer/integration
- transactional REST API at `api.mkety.com/v1/mail`;
- SMTP where production-certified;
- webhooks;
- scoped API keys;
- standards-compatible IMAP/SMTP via dedicated gateway;
- autoconfig/autodiscover.

### Commercial
- separate Mail entitlement;
- Mail Starter / Growth / Business self-service families;
- Enterprise Mail custom;
- prepaid 1/3/6/12-month terms;
- hard quotas rather than silent postpaid overage;
- active database plan version is the runtime commercial price source;
- Admin price/name/description updates create a new immutable billing version;
- existing subscriptions/history keep the version on which they were purchased.

### Admin/operations
- reconcile bootstrap catalog;
- create versioned Mail plan changes;
- inspect tenant Mail workspaces;
- control safe workspace/onboarding state;
- inspect/edit safe domain sending/routing readiness state;
- review usage/capacity;
- billing/ledger/payment visibility through central Mkety;
- provider secrets and verified settlement remain protected.

## Mail remaining launch verification

- [x] shared tenant/identity/billing architecture;
- [x] Mail customer routes and persistent navigation;
- [x] domain-first onboarding flow;
- [x] plan/entitlement integration;
- [x] database-backed versioned pricing path in stabilization PR;
- [x] Admin Mail operations surface;
- [x] public Mail page and checkout consume active plan version in stabilization PR;
- [x] implementation exact-head CI for current stabilization changes on `5e85c2331208d5c49380cec77683c352e8fcf2ad`;
- [x] verify production `mail.mkety.com` host/runtime on main `455a1359cbde16d9eae34b6683c19cb4088d481e` via Mail Production run `36576563773`;
- [x] verify production Mail database migrations through the successful exact-SHA shared production migration in Enterprise AI production run `36568179070`;
- [x] verify R2/Queue/ingress/dispatch/events/content bindings and Workers via Mail Production run `36576563773`;
- [x] customer Mail migration/portability center: contact CSV, workspace JSON, EML import, RFC822/EML export;
- [ ] real inbound-domain test;
- [ ] real outbound transactional test;
- [ ] Customer Update queue/suppression test;
- [ ] app-password create/revoke test;
- [ ] IMAP/SMTP gateway acceptance;
- [ ] verify customer checkout -> settlement -> Mail entitlement -> onboarding end to end.

## First real-customer setup order

Do not onboard a waiting customer merely because a UI route exists. For each product:

### Mail
1. confirm tenant/account;
2. choose Mail plan and term;
3. complete verified payment/settlement;
4. confirm Mail entitlement and workspace creation;
5. connect and verify domain;
6. create first mailbox;
7. verify inbound and outbound mail;
8. verify inbox, storage and delivery event;
9. optionally create app password and external-client test;
10. optionally test portability by exporting one RFC822/EML message and/or importing a small standards-compliant EML sample;
11. only then call the Mail setup complete.

### Enterprise AI
1. confirm tenant/account and negotiated recurring contract;
2. ensure recurring subscription/entitlement is active;
3. provision usage/credits/budget;
4. create solution instance;
5. configure instructions and approved knowledge;
6. choose managed model or approved BYOK route;
7. connect Website/Telegram/other entitled channels to that solution;
8. configure branding and hostname;
9. configure reply pacing/reminders only if the business needs them;
10. use test/playground and inspect logs/accounting;
11. verify human-handoff behavior on one conversation while another remains automated;
12. test a future commitment reminder and cancellation/takeover behavior;
13. run guarded real-host/customer acceptance;
14. only after all gates pass enable production inference for customers.

## Mkety Media connector boundary

Mkety Media remains a standalone product/runtime with its existing commercial authority. The Platform now has a non-destructive connector for normal Mkety workspaces:

- tenant route: `/t/{tenant}/media`;
- Platform Control route: `/admin/platform-control/media`;
- Mkety stores only an admin-verified external Media workspace reference and link status;
- no Media API key, provider credential, invoice, subscription balance or internal customer data is copied into the Platform;
- tenant dashboard, sidebar and Billing route through the connector page before opening `media.mkety.com`;
- linked/suspended/disconnected state is visible to Mkety operators and the tenant;
- Media payment references continue to route to the standalone Media commercial system.

True cross-product SSO or automatic entitlement/data sync is deliberately not claimed yet. It requires a verified Media-side integration/token-consumer API. Until that exists, the safe connector is the product entry/add-on bridge and Media remains authoritative for its runtime and billing.

## Release rule

Until every required line above is implemented and verified, documentation must distinguish:
- implemented in repository;
- visible in customer/admin UI;
- deployed to production;
- production-accepted.

Never use “complete” for a capability that exists only in code but is not reachable, configured and verified for its intended customer/admin surface.

# Mkety Mail and Enterprise AI — customer setup and readiness runbook

Date: 2026-09-29
Status: pre-Starpips stabilization; production customer inference remains disabled until explicit promotion.

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
- [ ] bind channel connections to a selected solution instance;
- [ ] make channel runtime consume selected solution instructions/knowledge/model/pause;
- [ ] count injected instruction/knowledge context in reservation/accounting;
- [x] add deterministic customer test/playground for a selected solution;
- [x] expose customer-safe request/run logs;
- [x] persist conversations/messages;
- [x] implement per-conversation human takeover / resume rather than conflating it with global pause;
- [x] add configurable deterministic reply pacing backed by durable scheduled delivery rather than in-request sleeps;
- [x] add explicit future-commitment reminders with source-quote/date validation, idempotency, cancellation, retries and delivery-time entitlement checks;
- [x] connect recurring Enterprise AI contract/subscription lifecycle directly to product entitlement;
- [x] add tenant-specific versioned Enterprise AI contract pricing, included entitlements and billing-period credits;
- [ ] execute guarded `mkety-ai-production.yml` on the exact verified main SHA and verify `ai.mkety.com`;
- [ ] verify `api.mkety.com/v1/ai` through the production host;
- [ ] provision and verify `mkety-ai-delivery` Queue/DLQ and scheduler worker;
- [ ] exact-head CI and product-host acceptance;
- [ ] only then begin a real customer acceptance;
- [ ] only after that intentionally enable production customer inference.

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
- [ ] exact-head CI for current stabilization changes;
- [ ] verify production `mail.mkety.com` host and current deployed SHA;
- [ ] verify production Mail database migrations;
- [ ] verify R2/Queue/ingress/dispatch bindings and Workers;
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

## Release rule

Until every required line above is implemented and verified, documentation must distinguish:
- implemented in repository;
- visible in customer/admin UI;
- deployed to production;
- production-accepted.

Never use “complete” for a capability that exists only in code but is not reachable, configured and verified for its intended customer/admin surface.

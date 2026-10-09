# Mkety Mail Production Architecture

## Product model

Mkety Mail is one product with two entry points:

- Standalone: `mail.mkety.com`
- Native Mkety tenant: `/t/{tenant}/mail`

Both use the same Mkety identity, tenant, roles, billing identity and Mail backend.

## Data architecture

### PostgreSQL via Hyperdrive — source of truth

Authoritative records live in Mkety's existing PostgreSQL database:

- Mail workspace
- domains
- mailboxes
- Mailbox ingress aliases that map exact Cloudflare subdomain recipients to canonical tenant mailboxes
- mailbox members
- threads
- message metadata
- contacts
- templates
- suppressions
- API keys
- app passwords
- customer updates and per-recipient state
- delivery events
- automation rules
- shared-inbox notes/assignment state
- quotas and usage counters

D1 is intentionally not the source of truth for Mkety Mail. Splitting tenant/auth/billing across Postgres and D1 would create duplicate identity and synchronization risk.

### R2 — mail content and attachments

Bucket: `mkety-mail-storage`

R2 stores:

- raw RFC822/MIME messages
- parsed HTML/text bodies
- attachments
- large generated exports

Postgres stores only R2 object keys and searchable metadata.

### KV — ephemeral acceleration only

A dedicated Mail KV namespace may be used for:

- rate-limit counters
- temporary ownership challenges
- autoconfiguration cache
- anti-abuse flags
- short-lived idempotency/cache markers

KV is not authoritative storage for messages, users, domains, billing or contacts.

### Queues — Customer Updates

Queue: `mkety-mail-send`
Dead-letter queue: `mkety-mail-dead`

A Customer Update is expanded to one job per recipient. No 50-recipient shared-To/BCC batches are used.

Benefits:
- privacy
- retries
- independent delivery status
- throttling
- suppression enforcement
- circuit-breaker support

### Cloudflare Email Service

Cloudflare Email Routing is the inbound transport.
Cloudflare Email Sending is the transactional/operational outbound transport.

Customers never receive Mkety's Cloudflare credentials.

#### Mkety first-party address split

- Root MX remains on Zoho. `hello@mkety.com` continues to be received and managed in Zoho.
- First-party `info@mkety.com`, `support@mkety.com`, and other explicitly provisioned root mailboxes live in the reserved Mkety Mail workspace.
- Cloudflare Email Sending may be configured for `mkety.com` only for the reserved first-party tenant after SPF/DKIM verification. Preserve the existing root DMARC record and all Zoho MX records. Never enable Cloudflare Email Routing or a catch-all on the root domain.
- Zoho selectively forwards the root Mkety Mail addresses to exact recipient routes on `mail.mkety.com`. Cloudflare routes those messages to `mkety-mail-ingress`, which resolves each alias to the canonical root Mail mailbox. `hello@` is excluded.
- Transactional platform mail uses `info@mkety.com` as From and `support@mkety.com` as Reply-To. Public contact paths that use `hello@mkety.com` remain Zoho-owned.
- Setup requires exact, verified Zoho forward destinations and controlled receive/reply tests. A queued or direct Cloudflare send is not proof of this inbound path.

## Runtime components

### Main Mkety application

Responsibilities:
- authentication and tenant isolation
- onboarding
- domains/mailboxes
- contacts/templates
- shared inbox UX
- Customer Update creation
- transactional REST API
- analytics
- suppressions
- automation configuration
- billing and entitlements

### Mail ingress Worker

Worker: `mkety-mail-ingress`

Responsibilities:
- receive Cloudflare-routed inbound messages
- resolve recipient against Mkety
- reject unknown recipients
- optional external forwarding
- write raw MIME into R2
- notify Mkety ingest API

### Mail dispatch Worker

Worker: `mkety-mail-dispatch`

Responsibilities:
- consume `mkety-mail-send`
- deliver one recipient per job
- retry transient failures
- report results to Mkety
- send terminal failures to DLQ

### Mail-app gateway

Hosts:
- `imap.mkety.com:993`
- `smtp.mkety.com`

This is a dedicated TCP service because standard HTTP Workers cannot expose a conventional public IMAP listener.

Authentication uses revocable Mkety Mail app passwords, never the user's main Mkety password.

Mail clients:
- Apple Mail
- Outlook
- Gmail mobile third-party account
- Thunderbird
- standards-compatible IMAP/SMTP clients

Autoconfiguration:
- `autoconfig.mkety.com`
- `autodiscover.mkety.com`

## Product domains

- `mkety.com/mail` — public product page
- `mail.mkety.com` — Mail application
- `api.mkety.com/v1/mail` — developer API
- `smtp.mkety.com` — SMTP submission
- `imap.mkety.com` — IMAP
- `autoconfig.mkety.com` — Mozilla/standard autoconfig
- `autodiscover.mkety.com` — Outlook autodiscovery

## One-click Mkety integration

Existing Mkety/MkSaaS/Enterprise customers do not create another identity.

```
Existing tenant
  ↓
Enable Mkety Mail
  ↓
mail_workspaces row using same tenant_id
  ↓
existing members/roles remain authoritative
  ↓
connect domain
  ↓
create mailboxes
```

No cross-product API keys are required between MkSaaS and Mkety Mail because they share the central tenant boundary.

## Media native integration pattern

Mkety Media currently remains an isolated product runtime. The safe long-term connection pattern is the same model used by Mail:

1. Central Mkety tenant/auth/billing remain authoritative.
2. A tenant enables Media from the Mkety workspace.
3. Mkety issues a product-scoped handoff/session to Media.
4. Media maps that handoff to its isolated runtime tenant.
5. Entitlements and billing originate from central Mkety.
6. Media keeps only Media-specific operational/storage data.
7. No duplicate customer passwords are created.
8. Existing standalone Media accounts are migrated by verified email/account ownership and linked to a central Mkety user/tenant.
9. Product-specific webhooks remain isolated and fail-closed.
10. The integration is rolled out behind an entitlement/feature flag with reversible mapping.

Recommended future identifiers:
- central `tenant_id`
- central `user_id`
- Media external product tenant ID
- immutable mapping table
- product audience `mkety-media`

This allows Media to stay independently deployable while feeling like one-click native Mkety.

## Security requirements

- tenant ID on every tenant-owned Mail table
- verified sender-domain ownership
- scoped hashed API keys
- salted hashed app passwords
- suppression check before every send
- per-tenant quotas
- new-domain warm-up
- complaint/bounce circuit breakers
- signed internal Worker callbacks
- secret rotation
- no customer Cloudflare API tokens stored by default
- R2 objects namespaced by tenant/mailbox
- internal endpoints authenticated by dedicated Mail secret
- idempotent delivery callbacks
- audit trail for sensitive operations
- dead-letter review path

## Customer Updates boundary

Available at launch:
- operational/service/customer communications to existing customers or legitimate business contacts
- max initial audience: 3,000 active non-suppressed contacts per update
- one recipient per queued job

Coming Soon:
- promotional newsletters
- promotions/offers
- marketing automations
- A/B campaign testing

Marketing must use a marketing-capable engine when introduced.

## Cloudflare CI token permissions

The repository `CLOUDFLARE_API_TOKEN` used by the Mkety Mail production workflow must be scoped to the Mkety Cloudflare account and include the permissions required by the existing Mkety deployment plus:

- **Workers R2 Storage Write** — list/create/manage the Mail R2 bucket.
- **Queues Edit** — create/list Mail send, delivery-event and dead-letter queues, publish jobs and manage queue subscriptions.
- **Email Sending: Edit** — use Cloudflare Email Service sending for onboarded domains.
- **Zone Settings Write** — enable Email Routing DNS for customer domains.
- **Email Routing Rules Write** — create/update inbound routing rules when Mkety automates mailbox delivery.
- **Email Routing Addresses Write** — create forwarding destinations when external-inbox forwarding is used.

The production workflow fails before application deployment if R2/Queues/Event Subscription permissions are absent. Never broaden the token to unrelated Cloudflare accounts.

## Production readiness checklist

- [ ] migration baseline green
- [ ] typecheck green
- [ ] lint green
- [ ] tests green
- [ ] build green
- [ ] Cloudflare/Vinext smoke green
- [ ] production Postgres migration applied
- [ ] R2 bucket provisioned
- [ ] send queue and DLQ provisioned
- [ ] ingress Worker deployed with internal secret
- [ ] dispatch Worker deployed with internal secret
- [ ] Cloudflare Email Sending credential validated
- [ ] Mail application runtime receives Mail internal secret
- [ ] mail.mkety.com attached and smoke tested
- [ ] autoconfig/autodiscover hosts attached and smoke tested
- [ ] inbound domain routing smoke test
- [ ] Zoho-to-Cloudflare exact alias routing test with `hello@` excluded
- [ ] outbound transactional smoke test
- [ ] Customer Update queue smoke test
- [ ] suppression smoke test
- [ ] app-password creation/revocation smoke test
- [ ] IMAP/SMTP gateway acceptance test
- [ ] rollback evidence retained

## Launch UX principle

The customer sees business language only:

- Connect domain
- Create business email
- Open inbox
- Add team
- Import customers
- Send customer update
- Connect Gmail/Outlook/Apple Mail
- Create API key

DNS, MX, DKIM, R2, Workers, queues and Cloudflare credentials remain implementation details.


## Production completion trigger — 2026-09-27

This proof-neutral documentation update records the guarded Mail production completion attempt after merge of PR #142.

Exact pre-trigger main SHA:

`37179f1fbc620bc963fef91ef8ee0bb9b5f1aded`

The production workflow must still enforce its existing exact-SHA quality, migration, Cloudflare permission, infrastructure, deployment, auth-binding and smoke gates. A failed gate is not authorization to bypass or weaken the gate.


## Production completion retry — aligned proof base

The Migration Baseline and Cloudflare vinext Smoke proof workflows were certified together on:

`26f0cead52d9ee69932af8ed419ed97f12413330`

This retry remains subject to all existing guarded production checks and must stop on any failed permission, migration, deployment, binding, or smoke gate.


## Production completion trigger 2 — 2026-09-27

Second guarded Mail production attempt after merge of the migration-baseline proof inheritance repair.

Exact pre-trigger main SHA:

`f9fddbe7265731413b31c0ce660df3963fac87a1`

All existing release gates remain mandatory; this documentation commit exists only to activate the repository's guarded `[mail-production]` push path.


## Production completion trigger 3 — serialized release

Final guarded production attempt after the Mail release workflow gained concurrency serialization and a final main-head revalidation.

Exact pre-trigger main SHA:

`06d8019c49c097cb6183d8a0b948c0477933876f`

This run is authorized only for the exact resulting main SHA and must cancel/replace any older in-progress Mail production run.


## Production completion status — authoritative serialized attempt

Authoritative guarded run:

- workflow: Mkety Mail Production
- run: 36358566312
- release SHA: `e6bf486de993046bedbd6f32e901d43159c16081`

Verified:

- exact release authorization: success;
- stale-release/migration-proof guards: success;
- production PostgreSQL migration: success;
- ephemeral migration host cleanup: success;
- Cloudflare account credential verification: success.

Current blocker:

- **Workers R2 Storage Write** is missing from the repository `CLOUDFLARE_API_TOKEN`;
- the R2 permission probe returned **HTTP 403**;
- the permission preflight failed closed.

Because the preflight failed, the workflow skipped:

- production Hyperdrive resolution for the Mail deploy stage;
- exact `mkety-platform` application redeploy;
- auth-binding post-deploy verification;
- R2 bucket provisioning;
- Mail queues/DLQs;
- Mail Worker deployment;
- Mail runtime secret attachment;
- Mail domain attachment;
- production Mail smoke;
- deployment evidence publication.

No bypass is authorized. The next production action is to update the existing repository Cloudflare token with the required R2 permission (and retain the full Mail permission set), then rerun the guarded `[mail-production]` flow.

Release-workflow hardening completed during this attempt:

- PR #142: shell-portable proof walk;
- PR #143: migration-baseline proof inheritance only across unchanged baseline-trigger paths;
- PR #144: serialized Mail production runs, independent exact quality gates, and final main-head revalidation.

Do not restart Mail architecture design. Do not begin the Mkety AI implementation workstream until this Mail infrastructure release is completed and the required production functional tests pass.


## Mail login and product-session handoff

Mkety Mail must not use a wildcard `.mkety.com` application-session cookie.

Reason:

- Mkety Academy, Media, Trading and other `*.mkety.com` products may remain independently deployed or intentionally isolated;
- broad cookie sharing could alter those products' authentication behavior;
- a future product integration must be explicit rather than relying on an accidental shared-cookie boundary.

The Mail login path is therefore product-scoped:

1. the browser opens `mail.mkety.com`;
2. when no Mail-host session exists, Mail redirects to the central Mkety app handoff endpoint;
3. the central endpoint verifies the existing central Mkety session;
4. it creates a random one-time Mail handoff using the existing expiring auth transaction store;
5. the browser returns to the Mail host with only the opaque handoff token;
6. Mail atomically consumes the token;
7. Mail creates a normal host-scoped Mkety application session for that user;
8. the browser continues to `/mail/app`;
9. Mail still checks `workspace.mail` before protected tenant Mail access.

Handoff properties:

- product audience is fixed to Mail;
- token is opaque;
- lifetime is 60 seconds;
- token is one-time because the auth transaction row is deleted on successful consume;
- raw central session tokens are never placed in URLs;
- Mail never receives provider credentials;
- no wildcard Mkety application cookie is created;
- unrelated Mkety subdomains are unaffected.

This pattern may later be generalized for Media or another separately deployed Mkety product only after that product is explicitly integrated and tested. It must not be enabled globally by hostname wildcard.

## Commercial access and usage boundary

Mkety Mail is a separately entitled Mkety product/workspace.

- New self-service activation requires `workspace.mail`.
- Public self-service subscriptions are Mail Starter ($4.99/month), Mail Growth ($9.99/month) and Mail Business ($24.99/month).
- Enterprise Mail is custom.
- A tenant may hold a normal Mkety Platform subscription and a separate Mail subscription at the same time.
- Entitlement resolution composes grants across qualifying active subscriptions so add-ons do not replace the tenant's Platform entitlements.
- Billing checkout prevents duplicate subscriptions within the same product family while allowing one Platform-family subscription plus one Mail-family subscription.
- Mail quota enforcement resolves the tenant's current paid Mail subscription from Billing and applies plan-specific monthly limits in addition to the existing daily/domain warm-up and reputation controls.
- Self-service Mail uses hard limits and prepaid capacity packs rather than surprise postpaid overage.
- Customer-facing Mail usage exposes only the tenant's plan, allowance, used/remaining quota and purchased capacity.
- Raw provider cost, account-wide Cloudflare capacity, internal reputation scoring, other-tenant usage and operations-only telemetry remain restricted to authorized Mkety admin/ops.

This same product-composition approach is the intended foundation for later centrally enabled products such as Mkety Media: one Mkety tenant/team/billing identity with product-specific entitlements and focused operational runtimes.

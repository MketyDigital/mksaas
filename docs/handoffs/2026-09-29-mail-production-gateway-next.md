# 2026-09-29 Mail production accepted — external-client gateway next

## Authority

This is the latest operational handoff for Mkety Mail / Enterprise AI before controlled real-customer acceptance.

Current branch: `feat/mail-external-client-gateway-20260929` from production `main` `455a1359cbde16d9eae34b6683c19cb4088d481e`.

## Production truth already closed

### Enterprise AI infrastructure
- Enterprise AI production infrastructure was deployed successfully on guarded production run `36568179070`.
- Production DB migrations, AI Queue/DLQ, `mkety-ai-delivery` worker/scheduler, `ai.mkety.com`, `api.mkety.com`, internal secret synchronization and fail-closed smoke all passed.
- Customer inference remains intentionally OFF.
- No Starpips acceptance has begun.
- The next Enterprise AI action is controlled first-customer setup/acceptance; only after that may customer inference be intentionally promoted.

### Mkety Mail Cloudflare/runtime
- Current production main: `455a1359cbde16d9eae34b6683c19cb4088d481e`.
- Mkety Mail Production run `36576563773` succeeded.
- Exact-main authorization, production DB migration, Cloudflare permission preflight, Hyperdrive resolution, exact app deploy, central-auth binding verification, R2/Queue provisioning, Mail ingress/dispatch/events/content worker deployment, runtime-secret synchronization, application-domain attachment and production smoke all passed.
- `mail.mkety.com` / Mail HTTP/runtime production infrastructure is therefore accepted at the infrastructure/host level.
- Real customer-domain inbound/outbound, Customer Updates suppression, app-password/external-client, and checkout→entitlement→onboarding remain customer acceptance tests rather than infrastructure claims.

## Existing external-client gateway check

The latest `Mkety Mail Live Readiness` diagnostic run `36574979021` resolved `imap.mkety.com` and `smtp.mkety.com`, but:
- `imap.mkety.com:993` trusted TLS was unavailable;
- `smtp.mkety.com:465` trusted TLS was unavailable.

Repository audit found no previously deployed/accepted Postfix, Dovecot or Mkety TCP gateway implementation. External-client UI/autoconfig remains fail-closed through `MKETY_MAIL_EXTERNAL_CLIENTS_ENABLED=false`.

## Active gateway implementation

This branch adds a lightweight stateless gateway rather than a second mail stack:

- `ops/mail-gateway/gateway.mjs` — Node TLS IMAP4rev1/SMTPS service;
- `ops/mail-gateway/Dockerfile` — Node Alpine container;
- direct Coolify TCP mappings: `993:993`, `465:465`; health port `8080`;
- target limits: 0.25 CPU / 128 MB;
- no database credential in the gateway;
- no local mailbox/message store;
- one derived internal gateway secret shared only with the production Mkety app;
- publicly trusted TLS certificate issued through DNS-01;
- scheduled certificate renewal redeploys the already-pinned gateway application without advancing its Git SHA.

Central Mkety internal gateway contract:
- app-password authentication;
- mailbox message index;
- RFC822 retrieval;
- read/star flag updates;
- SMTP submission through the existing Mail quota, suppression and send queue path.

Schema:
- stable numeric `imapUid` is added to Mail messages via migration `0034_mail_imap_uid.sql`;
- this avoids unstable/hash-derived IMAP UIDs that could corrupt client sync.

## Why the gateway is an always-on Coolify/OCI service

This is an intentional architecture decision, not a temporary workaround.

- Standard Cloudflare Workers do not currently accept inbound arbitrary TCP sockets, so an ordinary IMAP/SMTP client cannot connect directly to a Worker on 993/465.
- Cloudflare Tunnel can carry TCP, but ordinary non-HTTP published TCP services require client-side `cloudflared` unless additional L4 products are introduced; that is not acceptable for normal Apple Mail / Outlook / Thunderbird configuration.
- Cloudflare Spectrum can proxy arbitrary TCP on the appropriate paid Enterprise configuration, but it still proxies to an origin TCP service rather than replacing the IMAP/SMTP application protocol endpoint.
- Therefore Mkety keeps one tiny standards-compatible TCP service online 24/7 on the existing Coolify/OCI server and keeps all durable mail/auth/business state in the central Mkety platform.
- Cloudflare remains useful for authoritative DNS, DNS-01 certificate issuance, and could later front the origin with Spectrum if the commercial/security case justifies it.

Operational target:
- one stateless Node process;
- non-root container;
- 0.25 CPU / 128 MB RAM;
- ports 993 IMAPS, 465 SMTPS, 8080 health only;
- Coolify restart policy / health checks keep the service continuously available;
- weekly certificate-renewal workflow updates TLS material and redeploys the same pinned application;
- no database credentials or local mailbox store on the gateway.

This gateway must stay online continuously because external mail clients maintain/renew TCP/TLS sessions and expect those standard endpoints to be available independently of the web application.

## Audit state at handoff freeze

- Production `main`: `455a1359cbde16d9eae34b6683c19cb4088d481e`.
- Mail HTTP/runtime production: ACCEPTED by run `36576563773`.
- Enterprise AI infrastructure: ACCEPTED by run `36568179070`; customer inference remains OFF.
- External-client gateway production: NOT YET DEPLOYED/ACCEPTED.
- Latest pre-gateway live diagnostic `36574979021`: no trusted TLS on 993/465.
- PR #178 is the only active implementation/release PR for this gap.
- PR #178 pre-CodeQL-fix head `4c4845405bbde2041f7c9d362367b300446bad3b` passed CI, tests, type-check, lint, build, migration baseline, vinext, workspace smoke, content DB smoke and public candidate.
- CodeQL then identified workflow shell interpolation of release metadata. Commit `742328e7fb31ea8bb56714e1a51ad83de4130b6d` fixes it by treating event/confirmation/commit-message values as environment data. Final exact-head checks on the updated PR head are required before merge.
- MegaLinter remains the known repository-wide baseline; do not misclassify it as a gateway-specific regression without file-specific evidence.
- The workflow performs a pre-mutation Coolify application lookup plus public TLS probes. If a named managed `mkety-mail-gateway` app already exists, it is reused; if an unknown trusted TCP service already owns 993/465, deployment refuses takeover. No previously accepted gateway deployment exists in repository evidence.

## Next-session authoritative resume point

Start with PR #178. Do not reopen general Mkety feature development.

1. Confirm the latest PR #178 head is mergeable and that exact-head CI/tests/typecheck/lint/build/migration/vinext/candidate/security review are green.
2. Resolve any remaining review thread; do not suppress genuine security findings.
3. Merge PR #178 with exact release markers `[mail-production] [mail-gateway-production]`.
4. Observe Mkety Mail Production on the exact merged SHA and require SUCCESS first. This deploys/migrates the central app/internal gateway APIs.
5. Only after exact-SHA Mail Production succeeds, observe Mkety Mail Gateway Production:
   - existing-app/TCP preflight;
   - resolve Coolify server;
   - issue DNS-01 trusted certificate;
   - create or reuse the tiny `mkety-mail-gateway` app;
   - synchronize only the isolated internal gateway secret;
   - deploy pinned exact SHA;
   - point unproxied `imap.mkety.com` / `smtp.mkety.com` DNS at the server;
   - require trusted TLS, IMAP4rev1 CAPABILITY, SMTP AUTH greeting, health/readiness markers and fail-closed internal API.
6. Keep `MKETY_MAIL_EXTERNAL_CLIENTS_ENABLED=false` after infrastructure acceptance.
7. Record exact production SHA, Mail run ID, Gateway run ID, Coolify app identity (non-secret), and protocol/TLS acceptance in this handoff/status.
8. Then begin **one controlled real Mail customer acceptance**:
   - verified checkout/settlement → Mail entitlement/onboarding;
   - one real domain;
   - first mailbox;
   - real inbound + outbound;
   - Customer Update + suppression behavior;
   - create app password;
   - deliberately enable external-client acceptance for that controlled customer;
   - prove IMAP sync and SMTP submission from a standard external client;
   - revoke password and prove subsequent login fails;
   - leave external-client feature exposure at the intended product policy only after this passes.
9. After Mail customer acceptance, configure/accept the first Enterprise AI customer:
   - contract/payment/entitlement/credits;
   - solution instructions/knowledge/model;
   - channel binding;
   - playground/log/accounting;
   - human handoff;
   - reply pacing / supported reminder;
   - real-host/channel acceptance.
10. Only after Enterprise AI customer acceptance intentionally enable customer inference.
11. Only after both product customer acceptances begin Starpips production acceptance.

## Gateway acceptance boundary

The guarded gateway workflow must:
1. verify exact-main tests/type/lint/build/migration/vinext;
2. require successful Mkety Mail Production for the exact release SHA, ensuring the new migration/internal APIs are already live;
3. inspect Coolify for an existing `mkety-mail-gateway` app and probe existing 993/465 TLS before mutation;
4. refuse takeover if an unknown trusted TCP service already owns either endpoint;
5. create or reuse one lightweight Coolify app;
6. pin it to the exact release SHA;
7. deploy trusted TLS and the internal gateway secret;
8. point unproxied `imap.mkety.com` / `smtp.mkety.com` DNS at the Coolify server;
9. require trusted TLS on both ports;
10. require IMAP4rev1 CAPABILITY and SMTP AUTH greeting;
11. require the gateway internal HTTP API to remain unauthenticated/fail-closed;
12. keep `MKETY_MAIL_EXTERNAL_CLIENTS_ENABLED=false` after infrastructure acceptance.

Infrastructure acceptance does **not** claim app-password functional acceptance. That happens as the first external-client check during the controlled real Mail customer acceptance next session.

## Exact next sequence

1. certify and merge this gateway branch;
2. merge with guarded release markers `[mail-production] [mail-gateway-production]`;
3. require Mail Production to migrate/deploy the exact release SHA successfully;
4. gateway workflow then deploys/accepts the TCP service;
5. update this handoff/status with exact run/SHA evidence;
6. next session begin one controlled real Mail customer acceptance:
   - verified checkout/settlement → Mail entitlement/onboarding;
   - connect one real domain;
   - create first mailbox;
   - real inbound + outbound;
   - Customer Update suppression/queue;
   - create app password, enable external-client feature deliberately for the acceptance, test IMAP mailbox sync and SMTP send, revoke password and prove revoked login fails;
7. after Mail customer acceptance, configure the first Enterprise AI customer:
   - contract/payment/entitlement/credits;
   - solution instructions/knowledge/model;
   - channel binding;
   - playground/log/accounting;
   - human handoff;
   - reply pacing / supported commitment reminder;
   - real-host/channel acceptance;
8. only after Enterprise AI customer acceptance intentionally enable customer inference;
9. only after these platform/customer gates begin Starpips production acceptance.

## Safety rule

Do not call external-client support production-accepted merely because 993/465 are reachable. Infrastructure TLS/protocol acceptance and real app-password/client functional acceptance are separate gates.

## Current Mkety first-party Mail and Starpips sequence — 2026-10-02

This section supersedes earlier handoff ordering that placed Starpips after an Enterprise AI customer. The approved order is:

1. Complete Mkety first-party Mail using the reserved platform-owned Mail tenant and `info@mkety.com`; ZITADEL remains on its current provider until a real Mail-backed test passes with rollback ready.
2. Make Starpips the first paid Enterprise Mail customer. Confirm its existing commercial terms before checkout; do not infer or invent an Enterprise Mail price from an AI contract.
3. After Starpips completes and accepts its Mail setup, use Mkety's own reserved internal system and isolated non-production fixture to verify Enterprise AI commercial, runtime and accounting paths.
4. Keep Starpips out of Enterprise AI unless there is a separately approved AI contract. Keep production inference disabled after the internal AI fixture is cleaned up.

Customer-facing transactional producers currently identified in `src/` are tenant invitations and ZITADEL identity mail. Invitations use the shared first-party sender; ZITADEL remains the identity-owned producer through its selected SMTP provider. Billing/payment, domain/product-status and support-acknowledgement email producers were not present in the source inventory as of this date; do not manufacture notification events without a product event contract. Mail automation/customer-update messages remain customer Mail product sends, not Mkety platform notifications.

### Local first-party Mail implementation checkpoint — 2026-10-02

Branch `codex/mkety-first-party-mail-20261002` is based on `2181bc76de4136c068f3b9aa54555b56a2fa8ddf`. It adds SMTP-only reserved-tenant credentials, first-party transactional queueing with tenant-scoped idempotency, invitation delivery, reserved inbox operator checks, `info@mkety.com` support defaults, and an explicitly tested/activated ZITADEL SMTP workflow with Brevo rollback. Invitation links now default to `https://app.mkety.com` if `NEXT_PUBLIC_APP_URL` is absent. The SMTP provisioning action exits before mailbox lookup if the reserved workspace is missing/inactive.

Local evidence: 11 focused suites / 52 tests pass; TypeScript, migration baseline, repository ESLint (0 errors; 19 existing warnings), `git diff --check`, and Vinext production build pass. The full Jest run had 274 suites pass, 1 skipped, and 7 failures across two unrelated child-process tests that receive `EPERM`/empty output in this restricted environment. No `customer-apps/assist` files are in this branch diff.

Production acceptance is still pending. DNS/provider/live workspace and ZITADEL status could not be inspected from this session. The production workflow requires the repository secret `MKETY_FIRST_PARTY_MAIL_TENANT_ID`; after issuing the one-time credential from Mail Operations, store it as `MKETY_FIRST_PARTY_MAIL_SMTP_PASSWORD`. Keep customer external clients disabled. Do not dispatch the provider test/activation workflow until domain, mailbox, credential and controlled recipient readiness are confirmed. Do not call first-party Mail production-ready from local checks alone.

Provisioning access check — 2026-10-02: no live tenant, Mail workspace, domain, mailbox, DNS record, repository secret, or ZITADEL provider was changed. The Cloudflare dashboard served a persistent security-verification page in the browser after one reload; no local Cloudflare API token was available. The production Mail Operations route redirected to ZITADEL, where secure sign-in returned the generic error `Could not create session for user`; no credential retry was made. The available GitHub connector can read repository metadata but has no Actions-secret management or workflow-dispatch operation, `gh` CLI is absent, and `git fetch origin main` cannot reach GitHub through the current network proxy. GitHub reports `main` at `58477b11e5271be34668e3d35fe2c85030cb9cbf`, newer than this local branch's base; do not update or merge shared `main` until a safe non-Assist sync path is available.

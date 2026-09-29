# 2026-09-29 final Mail/Enterprise handoff — gateway deployed; OCI ingress is the last Mail infrastructure blocker

## Authority

This section supersedes the older #178-era handoff below.

- Current production main: `f581b31443f255bbf8786d873562a390ee6698b3` (PR #189).
- Mail Production run `36639931406`: SUCCESS on that exact SHA.
- Enterprise AI infrastructure run `36568179070`: SUCCESS; customer inference remains OFF.
- Mail gateway run `36639931332` proved exact-SHA gateway deployment/readiness after trusted certificate issuance, Coolify configuration and central secret synchronization.
- PR #189 also deployed fail-closed commercial login enforcement: every external-client app-password authentication re-checks active Mail workspace plus `workspace.mail` entitlement.
- Corrected earlier gateway run `36637983178` proved Cloudflare authoritative DNS and public recursive DNS are correct/unproxied, then direct origin IMAPS 993 timed out.
- Direct runner SSH to the OCI host is unavailable. A same-host disposable probe confirmed OCI IMDS and instance-principal signer availability but VCN/network read returned 404, so that identity cannot manage Security Lists/NSGs. Standard/common OCI API credential names were not present under the tested protected-production secret names.
- The gateway is therefore deployed but **not yet public-TCP accepted**. The remaining infrastructure action is OCI/provider ingress for TCP 993 and 465.
- `MKETY_MAIL_EXTERNAL_CLIENTS_ENABLED` remains false.

## Exact resume point

1. Open OCI network policy for the validated Coolify origin: TCP 993 (IMAPS) and TCP 465 (SMTPS), public client source as required for standards-compatible mail clients. Preserve existing rules; do not replace the Security List/NSG.
2. Rerun the guarded Mail gateway release. The workflow must prove: exact release authorization, gateway health/readiness, Cloudflare authoritative/public DNS, trusted TLS using the public hostnames, IMAP4rev1 CAPABILITY, SMTP AUTH PLAIN/LOGIN greeting, and fail-closed internal API behavior.
3. Run the controlled app-password functional acceptance (successful auth/sync/send, revoke, then failed auth) before enabling external-client UI/autoconfig.
4. Record the accepted SHA/run IDs in the status + continuation docs.
5. Then begin Enterprise AI customer acceptance: contract, verified payment, entitlement/credits, solution, channels, branding/domain, playground, logs/accounting and handoff tests while global customer inference remains OFF.
6. Intentionally promote Enterprise AI inference only after that acceptance, then begin Starpips real-customer onboarding.

---

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

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

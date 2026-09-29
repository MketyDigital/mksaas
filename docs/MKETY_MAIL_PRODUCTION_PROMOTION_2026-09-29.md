# Mkety Mail production promotion — 2026-09-29

Release base: `e20d2c4949565787bfd0e1db8b93045d49df0bae`.

Purpose: authorize guarded production acceptance for the completed Mkety Mail stabilization and portability work.

The production workflow must:
- verify the exact main SHA and required CI/build/migration/Cloudflare evidence;
- apply production database migrations through the guarded executor;
- verify Cloudflare R2/Queue/Event permissions;
- provision/verify Mail R2, send/event queues and dead-letter queues;
- deploy Mail ingress, dispatch, event and content workers;
- rotate/synchronize internal Mail secrets;
- attach/verify `mail.mkety.com`, `api.mkety.com`, autoconfig/autodiscover and the Mail content host;
- run fail-closed public/app/autoconfig/API/content-worker smokes.

## Acceptance boundary

This promotion establishes production infrastructure and host readiness. Real inbound-domain, outbound transactional, Customer Update suppression/queue, app-password, IMAP/SMTP and customer checkout→settlement→entitlement→onboarding acceptance remain explicit post-deployment customer-readiness checks and must be recorded separately.

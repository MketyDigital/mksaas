# Mkety Mail final gateway acceptance — 2026-09-30

## Accepted Mail application release

Mkety Mail application/runtime production is accepted on main SHA
`36b170d40bfee6dc316428d8be67615a6e1b9353`.

Production run `36647366397` passed:

- exact-main/release authorization;
- private production DB migration and cleanup;
- exact-SHA Mkety application deployment;
- central Mkety auth-binding verification;
- R2 and Mail queue/DLQ provisioning;
- Mail ingress, dispatch, events and content worker deployment;
- runtime-secret synchronization;
- Mail application-domain reconciliation;
- production smoke, including a Mail-host check that remains on
  `mail.mkety.com` rather than following the intentional cross-host auth redirect.

## Gateway acceptance release

This document update intentionally matches the Mail production and Mail gateway
release path filters. The merge commit must include both release markers:

- `[mail-production]`
- `[mail-gateway-production]`

The gateway release remains fail-closed until it proves all of the following on
the same exact main SHA:

- existing managed trusted TLS is safely reused when both gateway hosts already
  validate and the Coolify application retains its certificate/key environment;
- the gateway exact-SHA deployment reports config, health, IMAP and SMTP
  readiness;
- optional direct-SSH/host-firewall diagnostics cannot block the authoritative
  public acceptance;
- manually provisioned/provider-level OCI ingress permits public TCP 993 and
  465;
- Cloudflare authoritative DNS contains one expected unproxied A record for
  each gateway hostname and public recursive DNS observes the same origin;
- direct-origin TLS validates `imap.mkety.com` on 993 and
  `smtp.mkety.com` on 465;
- IMAP advertises `IMAP4rev1` and completes `CAPABILITY`;
- SMTP advertises `AUTH PLAIN LOGIN`;
- the internal gateway API remains fail-closed without its isolated secret.

Customer-facing external-client enablement remains OFF until controlled
functional app-password acceptance is recorded after this infrastructure
acceptance passes.

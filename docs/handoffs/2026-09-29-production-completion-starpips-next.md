# Production completion handoff — Starpips real-world acceptance next

Date: 2026-09-29

## Production status

Mkety's Enterprise, Domains/DNS, branded application host, public presentation, and registrar fixed-egress path are now promoted and production-verified.

PR #159 is merged. Application/runtime production was promoted from main SHA 6c3d44cb0b1c9020950466bd5a37f8524e84a86b. Later main commits through 494d461c0648cd37c0b1a88ea90b4a9e496244dd changed workflows/tests only, not application/runtime source.

Core certification passed: build, typecheck, lint, tests, CI, vinext, migrations, Platform Core workspace smoke, AI Workspace smoke, Pull Request Validation, Live Gate, Production App Host diagnostic, and Public Candidate. MegaLinter still reports the known repository-wide security-scanner baseline and is not represented as green.

## Mkety Domains and DNS

Customer-facing branding is Mkety Domains / Mkety DNS. DomainNameAPI and Cloudflare are implementation providers and belong only in protected operations configuration.

Mkety Domains supports live availability and provider pricing, separate registration and renewal base pricing, real renewal-price fallback through the provider TLD catalog, configurable registration and renewal percentage/fixed markups, verified-settlement registration with full registrant data, renewal, registrar lock/privacy/nameserver policy, managed custom hostnames, and DNS routing.

Protected admin configuration includes registrar credentials/environment/base URL/nameservers/privacy/pricing policy and Cloudflare token/SaaS zone/app zone/CNAME target/TLS floor/managed-DNS proxy preference. Normal configuration changes are database-backed and should not require a build.

The registrar adapter follows the provider's current REST SDK contract:
- Live base: https://api.domainresellerapi.com/api/v1
- OT&E base: https://ote.domainresellerapi.com/api/v1
- Auth headers: X-API-KEY and __reseller
- Availability: POST /domains/bulk-search
- Pricing catalog: GET /products/tlds
- Registration: POST /domains/register-with-contacts
- Renewal: POST /domains/renew

The provider-issued Reseller ID is used exactly as issued and is not restricted to numeric-only values.

## Fixed-egress registrar relay

Production relay:
- URL: https://registrar-relay.mkety.com
- OCI outbound IP: 89.168.70.209
- DomainNameAPI whitelist: 89.168.70.209
- Coolify app: mkety-domainnameapi-relay
- Resource cap: 0.25 CPU / 128 MB RAM
- Provider credentials permanently stored on relay: no
- HMAC-SHA256 request authentication with freshness and nonce/replay protection
- Explicit operation allowlist; no general-purpose proxy

Production run 36533404427 succeeded. Live and OT&E quote-only registrar acceptance passed through the fixed OCI egress, and relay bindings were attached to both mkety-platform and mkety-app-host.

No real domain registration or renewal mutation was performed during certification. That is intentionally reserved for the Starpips real-world test.

## app.mkety.com

Before repair, production had no Worker Custom Domain, a bad proxied CNAME from app.mkety.com to mkety.com/app, and HTTP 530.

Production repair is complete. Run 36533417286 succeeded end to end:
- exact-main source verification;
- production Hyperdrive;
- ZITADEL callback/logout reconciliation;
- dedicated mkety-app-host build/deploy;
- auth and registrar-relay bindings;
- bad app DNS replacement with dedicated Worker Custom Domain;
- live / -> /app -> /login -> auth.mkety.com verification;
- workers.dev and preview URLs disabled;
- no rollback required.

Current intended ownership:
- mkety.com -> mkety-platform
- www.mkety.com -> mkety-platform
- app.mkety.com -> mkety-app-host

## Public site and CMS

The public production Worker was refreshed without changing Custom Domain ownership.

Production content migration/seed/smoke run 36534337504 completed successfully: migrations, public-content seed, billing seed, public-content smoke, billing smoke, and ephemeral migration-host cleanup all passed.

Final live production acceptance run 36534828404 succeeded:
- https://mkety.com/domains presents Mkety Domains and DNS;
- the public homepage discovers Mkety Domains;
- mkety.com and www.mkety.com remain on mkety-platform;
- app.mkety.com remains on mkety-app-host;
- branded app authentication chain passes.

Public customers should see Mkety product names, not underlying provider brands.

## Deliberate gates still closed

customerInferenceEnabled remains OFF intentionally.

Do not enable it just because infrastructure is production-ready. The next acceptance is the real Starpips customer/white-label test.

No real production registrar mutation has been certified yet. Live and OT&E read-only availability/pricing are certified.

## Next session — Starpips real-world acceptance only

1. Confirm latest main and production status before mutation.
2. Create/select the Starpips organization/tenant through the normal Mkety customer flow.
3. Configure Starpips brand identity and white-label settings.
4. Choose and provision the intended Starpips managed subdomain/hostname.
5. Verify custom-hostname ownership, TLS, routing, and tenant isolation.
6. Verify unauthenticated -> branded sign-in -> callback -> authenticated Starpips tenant flow.
7. Verify Starpips cannot read or mutate another tenant's data/configuration.
8. Exercise Mkety Domains live search and sell pricing; confirm provider base price plus configured markup.
9. If explicitly authorized for the test, perform the first real registrar mutation using verified settlement and real registrant contact details, then verify domain lifecycle and DNS state.
10. Verify renewal pricing/controls without renewing unless explicitly intended.
11. Exercise the Enterprise AI white-label hostname/application path while customer inference remains OFF.
12. Only after the Starpips real-world acceptance is fully green, make a separate intentional decision on enabling customer inference.

## Production evidence

- PR #159: merged.
- Registrar relay production: run 36533404427 — success.
- App-host production repair: run 36533417286 — success.
- Production content migration/seed/smoke: run 36534337504 — success.
- Final read-only live acceptance: run 36534828404 — success.
- Relay: https://registrar-relay.mkety.com
- Fixed egress: 89.168.70.209
- Customer inference: OFF intentionally.
- Remaining customer acceptance target: Starpips.

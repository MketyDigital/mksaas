# Production-ready handoff — Starpips real-world acceptance next

Date: 2026-09-29

## Production state

Mkety's repository and production infrastructure are ready for the next real customer acceptance.

### Main production platform

- PR #159 (Enterprise AI, platform dashboard, Mail, Domains/DNS and product controls) is merged.
- Production hardening/finalization PRs #162, #163, #164, #166, #167, #168, #170 and #171 are merged.
- `app.mkety.com` is served by the dedicated `mkety-app-host` Worker.
- Production app-host promotion verified:
  - root redirects to `/app`;
  - unauthenticated `/app` redirects to `/login`;
  - auth initiation redirects to branded `https://auth.mkety.com/ui/v2/login/...`;
  - production Hyperdrive and auth runtime bindings are present;
  - `app.mkety.com` Worker Custom Domain is active;
  - the auxiliary workers.dev production URL and preview URLs are disabled after acceptance.
- Production auth reconciliation has a successful run on the finalized Login V2 contract.

### Mkety Domains & DNS

Customer-facing product language is Mkety-only:
- Mkety Domains;
- Mkety DNS;
- live domain search/pricing;
- registration and renewal;
- managed DNS and nameservers;
- custom hostnames and HTTPS.

Provider brands remain implementation details in protected Platform Control/ops configuration.

Platform Control supports editable:
- registrar environment/credentials;
- nameservers and WHOIS privacy;
- registration markup percentage;
- renewal markup percentage;
- fixed registration/renewal add-ons;
- Cloudflare domain API token rotation;
- Cloudflare account/zone IDs;
- SaaS CNAME target;
- minimum TLS;
- managed-DNS proxy behavior.

Provider base prices are retained separately from customer sell prices. Customer sell prices are computed from current upstream registration/renewal prices plus the active Mkety pricing policy.

### DomainNameAPI

- Fixed-egress relay: `https://registrar-relay.mkety.com`.
- OCI outbound IP: `89.168.70.209`.
- The IP is allowlisted in DomainNameAPI.
- Relay is deployed on the lightweight Coolify/OCI service.
- Production adapter uses the provider's current REST SDK contract:
  - `X-API-KEY` header;
  - `__reseller` header;
  - `/api/v1/domains/bulk-search`;
  - `/api/v1/products/tlds`;
  - `/api/v1/domains/register-with-contacts`;
  - `/api/v1/domains/renew`.
- Final fixed-egress acceptance passed for both Live and OT&E quotes.
- Final acceptance was quote-only and performed no registration or renewal mutation.
- Registrar mutations remain behind verified-settlement and explicit lifecycle guards.

### Public product presentation

The public site contains a dedicated Mkety Domains page and navigation entry describing:
- live domain search and pricing;
- registration;
- renewal management;
- Mkety DNS;
- DNS records/nameservers;
- custom hostnames;
- HTTPS/validation;
- connected use across supported Mkety products.

The public experience does not require customers to know or operate DomainNameAPI, Cloudflare or Coolify.

## Deliberate gate still OFF

Production Enterprise AI `customerInferenceEnabled` remains OFF until the Starpips real-world white-label acceptance is completed. Do not enable it merely because CI and infrastructure are green.

## Next session — Starpips real-world acceptance

Use Starpips as the first real customer acceptance:

1. Create or confirm the Starpips tenant/organization in production.
2. Confirm the intended Enterprise AI/product entitlement and billing state.
3. Allocate the Starpips managed `*.mkety.app` hostname or connect the intended Starpips-owned hostname.
4. Verify DNS/custom-hostname provisioning and HTTPS.
5. Verify the hostname resolves to the Starpips tenant only.
6. Verify branded login/session handoff and tenant isolation.
7. Verify Starpips branding (name, logos, favicon, colors and support/legal links).
8. Exercise the real customer-facing Enterprise AI path with a tiny controlled request.
9. Verify usage, provider cost, customer charge/rate-card accounting and audit/reconciliation state.
10. Only after all acceptance checks pass, intentionally enable the production customer inference gate.

## Safety / operations notes

- Production deployment/repair workflows are manual-only after this handoff.
- Do not add GitHub runner IPs to the registrar allowlist; the registrar path uses the fixed OCI egress.
- Do not bypass verified payment settlement for domain registration/renewal.
- Do not expose provider credentials or provider consoles to customers.
- Preserve `mkety.com`, `app.mkety.com`, `api.mkety.com`, `origin.mkety.com` and the approved `*.mkety.app` domain map.
- MegaLinter still carries known repository-wide baseline findings; core build, typecheck, lint, tests and production acceptance are the release evidence used here.

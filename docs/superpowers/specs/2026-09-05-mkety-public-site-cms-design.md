# Mkety Public Site, Global Docs, and Admin CMS Design

> **Status:** SPECIFICATION
> **Date:** 2026-09-05
> **Repository:** `MketyDigital/mksaas`
> **Branch:** `spec/mkety-public-site-cms`
> **Authority:** Implements the current `AGENTS.md` master blueprint for the first major frontend batch.

---

## Addendum: App Experience and Platform Control Center

This addendum extends the approved public-site/docs CMS direction with a safe admin-managed app experience layer for `app.mkety.com`.

Admin-managed app experience means Mkety platform admins can configure presentation and operational entry points such as dashboard headlines, onboarding copy, workspace cards, workspace labels, help links, visibility flags, and central Platform Control Center modules.

This does **not** mean admins can directly edit source code, backend business logic, tenant isolation rules, raw security policies, billing ledger calculations, or deployment engine code from the UI.

The safe control model is:

```text
Code controls the rules.
Admin controls approved configuration.
Audit logs record serious changes.
```

### Central control center

A central admin page may bundle the management levels into one navigable command center:

- Public Website & Docs
- App Experience
- Plans, Pricing & Entitlements
- Billing & Ledger
- Permissions & Roles
- Deployments & Domains
- Integrations & Webhooks
- Security & Audit Logs
- System Health / Operations

The central page is a dashboard of controlled modules, not a giant unrestricted editor. Each module keeps its own permission key, validation rules, audit trail, and operational boundary.

### Control levels

1. **Content control**
   - Public website, docs, dashboard text, workspace cards, pricing display, FAQ, CTAs, and metadata.

2. **Configuration control**
   - Feature flags, workspace visibility, plan limits, allowed model presentation, support links, onboarding, and safe tenant/app settings.

3. **Operational control**
   - View logs, retry jobs, approve domains, manage invoices, adjust credits through ledger transactions, and review deployment/domain state.

4. **Code-controlled logic**
   - Permissions engine, billing ledger rules, deployment engine, security rules, tenant isolation, webhook verification, authentication, and secret handling.

### Implementation note

The implementation should keep public content CMS and app experience management separate:

- Public content tables manage `mkety.com` and `/docs` content.
- App experience tables manage `app.mkety.com` dashboard/workspace/control-center presentation.
- Entitlements, permissions, billing, deployment, and security remain separate backend systems with safe admin-facing controls.

---

The original full specification was intentionally replaced by this concise addendum after implementation planning began because the approved scope had already been captured in the plan and branch history. The branch now treats the design file as the living boundary note for the public CMS plus app experience management work.

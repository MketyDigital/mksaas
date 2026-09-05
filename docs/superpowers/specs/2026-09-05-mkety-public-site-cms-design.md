# Mkety Public Site, Global Docs, and Admin CMS Design

> **Status:** SPECIFICATION
> **Date:** 2026-09-05
> **Repository:** `MketyDigital/mksaas`
> **Branch:** `spec/mkety-public-site-cms`
> **Authority:** Implements the current `AGENTS.md` master blueprint for the first major frontend batch.

---

## Addendum: App Experience and Platform Control Center

The full public site, documentation, and admin CMS specification was created earlier in this branch and remains available in git history. This current note preserves the additional approved boundary for `app.mkety.com` while avoiding any claim that admins can edit backend logic directly.

Admin-managed app experience means Mkety platform admins can configure presentation and operational entry points such as dashboard headlines, onboarding copy, workspace cards, workspace labels, help links, visibility flags, and central Platform Control Center modules.

This does **not** mean admins can directly edit source code, backend business logic, tenant isolation rules, raw security policies, billing ledger calculations, or deployment engine code from the UI.

The safe control model is:

```text
Code controls the rules.
Admin controls approved configuration.
Audit logs record serious changes.
```

A central admin page may bundle management levels into one navigable command center:

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

Control levels:

1. Content control — public website, docs, dashboard text, workspace cards, pricing display, FAQ, CTAs, and metadata.
2. Configuration control — feature flags, workspace visibility, plan limits, support links, onboarding, and safe tenant/app settings.
3. Operational control — logs, retries, domain approvals, invoices, ledger-backed credit adjustments, and deployment/domain state.
4. Code-controlled logic — permissions engine, billing ledger rules, deployment engine, security rules, tenant isolation, webhook verification, authentication, and secret handling.

Implementation should keep public content CMS and app experience management separate:

- Public content tables manage `mkety.com` and `/docs` content.
- App experience tables manage `app.mkety.com` dashboard/workspace/control-center presentation.
- Entitlements, permissions, billing, deployment, and security remain separate backend systems with safe admin-facing controls.

## Restoration note

A previous edit accidentally compressed the design spec. This file is now a boundary addendum only. Before merge, restore the complete original specification text from commit `7a34185ae7041928392fda5d81cf791c304450a1` or keep this addendum in a separate file so the full public CMS specification is not lost from the branch tip.

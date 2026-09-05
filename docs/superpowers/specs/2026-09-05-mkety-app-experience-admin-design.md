# Mkety App Experience and Platform Control Center Addendum

> **Status:** SPECIFICATION ADDENDUM
> **Date:** 2026-09-05
> **Repository:** `MketyDigital/mksaas`
> **Branch:** `spec/mkety-public-site-cms`
> **Related Spec:** `docs/superpowers/specs/2026-09-05-mkety-public-site-cms-design.md`

---

## Goal

Extend the public website/docs CMS work with a safe admin-managed app experience layer for `app.mkety.com`.

This lets Mkety platform admins manage dashboard presentation, workspace labels/cards, onboarding copy, help links, workspace visibility, and central Platform Control Center module presentation without editing application source code.

---

## Safety Boundary

Admin-editable app experience does **not** include direct editing of:

- source code
- backend business logic
- tenant isolation rules
- raw security policies
- billing ledger calculations
- deployment engine code
- webhook verification logic
- authentication/session rules
- secret handling

The safe control model is:

```text
Code controls the rules.
Admin controls approved configuration.
Audit logs record serious changes.
```

---

## Central Platform Control Center

A central admin page can bundle Mkety management levels into one navigable command center:

- Public Website & Docs
- App Experience
- Plans, Pricing & Entitlements
- Billing & Ledger
- Permissions & Roles
- Deployments & Domains
- Integrations & Webhooks
- Security & Audit Logs
- System Health / Operations

The page is a dashboard of controlled modules, not one giant unrestricted editor. Each module must keep its own permission key, validation rules, audit trail, and operational boundary.

---

## Control Levels

1. **Content control**
   - Public website, docs, dashboard text, workspace cards, pricing display, FAQ, CTAs, and metadata.

2. **Configuration control**
   - Feature flags, workspace visibility, plan limits, support links, onboarding, and safe tenant/app settings.

3. **Operational control**
   - Logs, retries, domain approvals, invoices, ledger-backed credit adjustments, and deployment/domain state.

4. **Code-controlled logic**
   - Permissions engine, billing ledger rules, deployment engine, security rules, tenant isolation, webhook verification, authentication, and secret handling.

---

## Implementation Direction

Keep public content CMS and app experience management separate:

- Public content tables manage `mkety.com` and `/docs` content.
- App experience tables manage `app.mkety.com` dashboard/workspace/control-center presentation.
- Entitlements, permissions, billing, deployment, and security remain separate backend systems with safe admin-facing controls.

Initial app experience data model:

- `platform_app_dashboard_settings`
- `platform_workspace_cards`
- `platform_app_control_center_modules`
- `platform_app_experience_revisions`

These tables provide admin-editable presentation/configuration. They do not replace the core backend systems that enforce permissions, billing, deployment, and security.

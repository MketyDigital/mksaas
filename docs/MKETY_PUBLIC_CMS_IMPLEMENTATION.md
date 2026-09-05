# Mkety Public Site CMS Implementation Notes

This branch implements the public Mkety website, global documentation, and admin-editable content system described in `docs/superpowers/specs/2026-09-05-mkety-public-site-cms-design.md`.

## Admin-editable boundary

Admins may manage public and customer-facing presentation content, including:

- Public website copy, navigation, CTAs, pricing display, FAQs, metadata, and docs.
- `app.mkety.com` presentation settings such as dashboard headline, workspace card labels, visibility, empty states, onboarding prompts, support links, and feature display names.

Admins must not edit source code, backend business logic, authorization rules, billing ledger behavior, deployment execution logic, or security-sensitive runtime behavior through this CMS.

## Current foundation

The branch adds platform-level content tables rather than storing Mkety global public content in tenant settings. Tenant settings remain for tenant/customer customization. Platform public content and app experience settings are global Mkety operational configuration.

## Verification status

GitHub connector edits cannot run local `pnpm test`, `pnpm type-check`, or `pnpm build`. Before merging, run:

```bash
pnpm test
pnpm type-check
pnpm build
```

Also apply/review migrations in a non-production database before production.

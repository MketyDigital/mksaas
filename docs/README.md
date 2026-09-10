# Mkety Engineering Documentation

This repository is the Mkety product codebase. It is no longer governed as the upstream Next.js SaaS AI starter/template that originally seeded parts of the project.

## Source-of-truth order

1. [`../AGENTS.md`](../AGENTS.md) — current Mkety architecture, product boundaries, naming, security, runtime, and infrastructure rules.
2. [`MKETY_DEVELOPMENT_CONTINUATION.md`](./MKETY_DEVELOPMENT_CONTINUATION.md) — operational milestone order and long-running continuation roadmap.
3. [`MKETY_RELEASE_GATE_HANDOFF_2026-09-10.md`](./MKETY_RELEASE_GATE_HANDOFF_2026-09-10.md) — latest public-site release-gate evidence, fixes, and remaining external gates.
4. The approved spec/plan for the active feature branch.
5. Current branch code, migrations, tests, and immutable CI/deployment evidence.

When an older document conflicts with `AGENTS.md` or the latest dated handoff, treat the older statement as historical and update it before using it as an implementation source.

## Active product/release documents

| Document | Purpose |
| --- | --- |
| [`MKETY_DEVELOPMENT_CONTINUATION.md`](./MKETY_DEVELOPMENT_CONTINUATION.md) | Public-site-first milestone order and Platform continuation sequence |
| [`MKETY_RELEASE_GATE_HANDOFF_2026-09-10.md`](./MKETY_RELEASE_GATE_HANDOFF_2026-09-10.md) | Current PR #24 release gate and operational blockers |
| [`MKETY_PUBLIC_CUTOVER_RUNBOOK.md`](./MKETY_PUBLIC_CUTOVER_RUNBOOK.md) | Production `mkety.com` cutover and rollback procedure |
| [`MKETY_PRODUCT_COMMERCIAL_SOURCE_OF_TRUTH.md`](./MKETY_PRODUCT_COMMERCIAL_SOURCE_OF_TRUTH.md) | Current public commercial/product contract |
| [`HANDOFF_MKETY_AUTH_ZITADEL_CLOUDFLARE.md`](./HANDOFF_MKETY_AUTH_ZITADEL_CLOUDFLARE.md) | Auth #16 external preview/ZITADEL promotion gate |
| [`HANDOFF_MKETY_PLATFORM_2026-09-07.md`](./HANDOFF_MKETY_PLATFORM_2026-09-07.md) | Platform stack handoff for Billing and downstream domains |
| [`MKETY_BILLING_ARCHITECTURE.md`](./MKETY_BILLING_ARCHITECTURE.md) | Billing provider-neutral architecture |
| [`MKETY_BRANCH_RETIREMENT.md`](./MKETY_BRANCH_RETIREMENT.md) | Active/retired branch boundaries |

## Current implementation plans and specs

Active public-site work is rooted in:

- `docs/superpowers/plans/2026-09-08-mkety-public-site-production.md`
- `docs/superpowers/plans/2026-09-10-mkety-release-gate-finish.md`
- `docs/superpowers/specs/2026-09-08-mkety-public-ai-design.md`
- `docs/superpowers/specs/2026-09-09-mkety-public-app-visual-contract.md`

The Platform promotion stack remains ordered:

```text
Auth #16
  ↓
Automation Webhooks #15
  ↓
Billing #21
  ↓
Entitlements #22
  ↓
Usage/Credits #23
```

Do not merge or flatten those branches out of order.

## Legacy/reference documents

Files such as `AUTHENTICATION.md`, `DEPLOYMENT.md`, `PROJECT_STRUCTURE.md`, `BRAND_GUIDELINES.md`, and other starter-era documents may still contain useful implementation history, but some retain template-era assumptions. They are **reference material, not higher-priority architecture authority**. In particular, do not reintroduce Auth.js/Auth0, OpenNext, Vercel, starter-template branding, or other superseded choices when current Mkety sources specify Mkety-owned auth, ZITADEL adapters, vinext, and Cloudflare.

## Verification rule

Do not declare a milestone production-ready from code inspection alone. Use fresh evidence for the exact candidate SHA: tests, type-check, lint, build, database smoke, vinext/Cloudflare checks, runtime diagnostics, candidate deployment, and any required real external integration/browser smoke. Production cutover additionally requires the explicit authorization phrase enforced by the cutover workflow.

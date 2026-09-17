# Mkety Engineering Documentation

This repository is the Mkety product codebase. It is no longer governed as the upstream Next.js SaaS AI starter/template that originally seeded parts of the project.

## Source-of-truth order

1. [`../AGENTS.md`](../AGENTS.md) — current Mkety architecture, product boundaries, naming, security, runtime, and infrastructure rules.
2. [`FEATURE_AGENT_HANDOFF_PROTOCOL.md`](./FEATURE_AGENT_HANDOFF_PROTOCOL.md) — mandatory completion/handoff discipline for every feature/workstream agent.
3. [`CURRENT_WORKSTREAM_STATUS.md`](./CURRENT_WORKSTREAM_STATUS.md) — concise pointer to what is being worked on now, its verified state, blockers, and exact next steps.
4. [`MKETY_DEVELOPMENT_CONTINUATION.md`](./MKETY_DEVELOPMENT_CONTINUATION.md) — operational milestone order and long-running continuation roadmap.
5. [`MKETY_RELEASE_GATE_HANDOFF_2026-09-10.md`](./MKETY_RELEASE_GATE_HANDOFF_2026-09-10.md) — public-site release-gate evidence, fixes, and remaining external gates until superseded by fresher verified evidence.
6. The approved spec/plan for the active feature branch.
7. Current branch code, migrations, tests, and immutable CI/deployment evidence.

When an older document conflicts with `AGENTS.md` or fresher verified handoff evidence, treat the older statement as historical and update it before using it as an implementation source.

## Active product/release documents

| Document | Purpose |
| --- | --- |
| [`FEATURE_AGENT_HANDOFF_PROTOCOL.md`](./FEATURE_AGENT_HANDOFF_PROTOCOL.md) | Mandatory feature-agent progress, evidence, blocker, and next-step update gate |
| [`CURRENT_WORKSTREAM_STATUS.md`](./CURRENT_WORKSTREAM_STATUS.md) | Current workstream, status, blocker, verification, and exact resume point |
| [`MKETY_DEVELOPMENT_CONTINUATION.md`](./MKETY_DEVELOPMENT_CONTINUATION.md) | Public-site-first milestone order and Platform continuation sequence |
| [`MKETY_RELEASE_GATE_HANDOFF_2026-09-10.md`](./MKETY_RELEASE_GATE_HANDOFF_2026-09-10.md) | Public-site release-gate and Platform continuation boundary; use only with fresher current-state evidence |
| [`MKETY_PUBLIC_CUTOVER_RUNBOOK.md`](./MKETY_PUBLIC_CUTOVER_RUNBOOK.md) | Production `mkety.com` cutover and rollback procedure |
| [`MKETY_PRODUCT_COMMERCIAL_SOURCE_OF_TRUTH.md`](./MKETY_PRODUCT_COMMERCIAL_SOURCE_OF_TRUTH.md) | Current commercial/product presentation contract |
| [`MKETY_AUTH_SOURCE_OF_TRUTH.md`](./MKETY_AUTH_SOURCE_OF_TRUTH.md) | Provider-neutral Mkety Auth boundary and ZITADEL adapter model |
| [`HANDOFF_MKETY_AUTH_ZITADEL_CLOUDFLARE.md`](./HANDOFF_MKETY_AUTH_ZITADEL_CLOUDFLARE.md) | Current Auth/ZITADEL/Cloudflare preview evidence and promotion gates |

## Current implementation plans and specs

The production public-site baseline is rooted in:

- `docs/superpowers/plans/2026-09-08-mkety-public-site-production.md`
- `docs/superpowers/plans/2026-09-10-mkety-release-gate-finish.md`
- `docs/superpowers/specs/2026-09-09-mkety-public-app-visual-contract.md`

The current Auth implementation is rooted in:

- `docs/superpowers/specs/2026-09-06-mkety-auth-zitadel-cloudflare-design.md`
- `docs/superpowers/plans/2026-09-06-mkety-auth-zitadel-vinext.md`
- `docs/HANDOFF_MKETY_AUTH_ZITADEL_CLOUDFLARE.md`

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

Do not merge or flatten those branches out of order. Reconcile any stale/open branch against current `main` before promotion, and record that reconciliation in `CURRENT_WORKSTREAM_STATUS.md`.

## Legacy/reference documents

Files such as `AUTHENTICATION.md`, `DEPLOYMENT.md`, `PROJECT_STRUCTURE.md`, `BRAND_GUIDELINES.md`, and other starter-era documents may still contain useful implementation history, but some retain template-era assumptions. They are **reference material, not higher-priority architecture authority**. In particular, do not reintroduce Auth.js/Auth0, OpenNext, Vercel, starter-template branding, or other superseded choices when current Mkety sources specify Mkety-owned auth, ZITADEL adapters, vinext, and Cloudflare.

## Verification rule

Do not declare a milestone production-ready from code inspection alone. Use fresh evidence for the exact candidate SHA: tests, type-check, lint, build, database smoke, vinext/Cloudflare checks, runtime diagnostics, candidate deployment, and any required real external integration/browser smoke. Production cutover additionally requires the explicit authorization phrase enforced by the cutover workflow.

Before a material feature/workstream PR is considered merge-ready, apply the mandatory handoff protocol and update `CURRENT_WORKSTREAM_STATUS.md` in that PR. Unfinished work must record its blocker and exact next step; unfinished work is not an exception to handoff documentation.

# Mkety Engineering Documentation

This repository is the Mkety product codebase. It is no longer governed as the upstream Next.js SaaS AI starter/template that originally seeded parts of the project.

## Source-of-truth order

1. [`../AGENTS.md`](../AGENTS.md) — current Mkety architecture, product boundaries, naming, security, runtime, and infrastructure rules.
2. [`FEATURE_AGENT_HANDOFF_PROTOCOL.md`](./FEATURE_AGENT_HANDOFF_PROTOCOL.md) — mandatory completion/handoff discipline for every feature/workstream agent.
3. [`CURRENT_WORKSTREAM_STATUS.md`](./CURRENT_WORKSTREAM_STATUS.md) — concise pointer to what is being worked on now, its verified state, blockers, and exact next steps.
4. [`MKETY_DEVELOPMENT_CONTINUATION.md`](./MKETY_DEVELOPMENT_CONTINUATION.md) — operational milestone order and long-running continuation roadmap.
5. [`handoffs/2026-09-29-mail-production-gateway-next.md`](./handoffs/2026-09-29-mail-production-gateway-next.md) — latest operational handoff: Mail Cloudflare production accepted; dedicated IMAP/SMTP gateway is the next gate before controlled customer acceptance.\n6. [`handoffs/2026-09-29-production-ready-starpips-next.md`](./handoffs/2026-09-29-production-ready-starpips-next.md) — historical pre-stabilization production handoff; Starpips remains paused behind current customer-acceptance gates.\n6. The approved spec/plan for the active feature branch.
7. Current branch code, migrations, tests, and immutable CI/deployment evidence.
8. Older release handoffs, including `MKETY_RELEASE_GATE_HANDOFF_2026-09-10.md`, are historical unless a newer current-state record explicitly points back to them.

When an older document conflicts with `AGENTS.md` or fresher verified handoff evidence, treat the older statement as historical and update it before using it as an implementation source.

## Active product/release documents

| Document | Purpose |
| --- | --- |
| [`FEATURE_AGENT_HANDOFF_PROTOCOL.md`](./FEATURE_AGENT_HANDOFF_PROTOCOL.md) | Mandatory feature-agent progress, evidence, blocker, and next-step update gate |
| [`CURRENT_WORKSTREAM_STATUS.md`](./CURRENT_WORKSTREAM_STATUS.md) | Current workstream, status, blocker, verification, and exact resume point |
| [`MKETY_DEVELOPMENT_CONTINUATION.md`](./MKETY_DEVELOPMENT_CONTINUATION.md) | Public-site-first milestone order and Platform continuation sequence |
| [`handoffs/2026-09-29-mail-production-gateway-next.md`](./handoffs/2026-09-29-mail-production-gateway-next.md) | Latest operational handoff: Mail production accepted; external-client gateway is the active infrastructure gate |\n| [`handoffs/2026-09-29-production-ready-starpips-next.md`](./handoffs/2026-09-29-production-ready-starpips-next.md) | Historical pre-stabilization handoff; Starpips remains paused |\n| [`MKETY_AI_RUNTIME_GATEWAY_ARCHITECTURE.md`](./MKETY_AI_RUNTIME_GATEWAY_ARCHITECTURE.md) | Shared AI runtime, provider, domain, channel, and Enterprise AI architecture |
| [`MKETY_AI_PRODUCT_COMMERCIAL_SECURITY_SPEC.md`](./MKETY_AI_PRODUCT_COMMERCIAL_SECURITY_SPEC.md) | Enterprise AI product, commercial, security, usage, and operations policy |
| [`MKETY_AI_ENTERPRISE_CAPABILITY_MAP.md`](./MKETY_AI_ENTERPRISE_CAPABILITY_MAP.md) | Broad Enterprise AI capability envelope; not a claim that every capability is launch-enabled |
| [`MKETY_RELEASE_GATE_HANDOFF_2026-09-10.md`](./MKETY_RELEASE_GATE_HANDOFF_2026-09-10.md) | Public-site release-gate and Platform continuation boundary; use only with fresher current-state evidence |
| [`MKETY_PUBLIC_CUTOVER_RUNBOOK.md`](./MKETY_PUBLIC_CUTOVER_RUNBOOK.md) | Production `mkety.com` cutover and rollback procedure |
| [`MKETY_PRODUCT_COMMERCIAL_SOURCE_OF_TRUTH.md`](./MKETY_PRODUCT_COMMERCIAL_SOURCE_OF_TRUTH.md) | Current commercial/product presentation contract |
| [`MKETY_AUTH_SOURCE_OF_TRUTH.md`](./MKETY_AUTH_SOURCE_OF_TRUTH.md) | Provider-neutral Mkety Auth boundary and ZITADEL adapter model |
| [`HANDOFF_MKETY_AUTH_ZITADEL_CLOUDFLARE.md`](./HANDOFF_MKETY_AUTH_ZITADEL_CLOUDFLARE.md) | Current Auth/ZITADEL/Cloudflare preview evidence and promotion gates |

## Current implementation plans and specs

The active Mkety Mail address migration uses:

- `docs/superpowers/specs/2026-10-09-mkety-full-domain-mail-cutover-design.md`
- `docs/superpowers/plans/2026-10-09-mkety-full-domain-mail.md`
- `docs/MKETY_MAIL_PRODUCTION_ARCHITECTURE.md`

The prior Zoho-forwarding split is historical and superseded for inbound `@mkety.com` hosting.

The production public-site baseline is rooted in:

- `docs/superpowers/plans/2026-09-08-mkety-public-site-production.md`
- `docs/superpowers/plans/2026-09-10-mkety-release-gate-finish.md`
- `docs/superpowers/specs/2026-09-09-mkety-public-app-visual-contract.md`

The current Auth implementation is rooted in:

- `docs/superpowers/specs/2026-09-06-mkety-auth-zitadel-cloudflare-design.md`
- `docs/superpowers/plans/2026-09-06-mkety-auth-zitadel-vinext.md`
- `docs/HANDOFF_MKETY_AUTH_ZITADEL_CLOUDFLARE.md`

The older Auth → Automation Webhooks → Billing → Entitlements → Usage/Credits promotion stack is historical and has already been reconciled into the current production baseline. Do not use those old branch numbers as the current continuation sequence.

For the active Enterprise AI completion, use PR #159, the September 28 dated handoff, and the current status/continuation documents. Stale AI PRs #145, #154, #157 and #158 must not be merged as substitutes for PR #159.

## Current Enterprise AI completion

PR #159 (`feat/enterprise-ai-complete-platform-20260928`) is the authoritative completion candidate. Repository verification is recorded against certified implementation SHA `6304ba5b30f39a7f9cf9f83c736155ddd9aaa833`; docs-only heads may be newer.

Production `customerInferenceEnabled` remains off. The guarded paid model benchmark, tiny real Workers AI + AI Gateway accounting acceptance, registrar/reseller fixed-egress verification, and Enterprise AI infrastructure promotion are already completed and documented in the current status/continuation evidence. The remaining gate is controlled first-real-customer acceptance, including customer-hostname white-label/isolation and end-to-end commercial/runtime verification, followed by an explicit intentional inference-enable decision.

## Legacy/reference documents

Files such as `AUTHENTICATION.md`, `DEPLOYMENT.md`, `PROJECT_STRUCTURE.md`, `BRAND_GUIDELINES.md`, and other starter-era documents may still contain useful implementation history, but some retain template-era assumptions. They are **reference material, not higher-priority architecture authority**. In particular, do not reintroduce Auth.js/Auth0, OpenNext, Vercel, starter-template branding, or other superseded choices when current Mkety sources specify Mkety-owned auth, ZITADEL adapters, vinext, and Cloudflare.

## Verification rule

Do not declare a milestone production-ready from code inspection alone. Use fresh evidence for the exact candidate SHA: tests, type-check, lint, build, database smoke, vinext/Cloudflare checks, runtime diagnostics, candidate deployment, and any required real external integration/browser smoke. Production cutover additionally requires the explicit authorization phrase enforced by the cutover workflow.

Before a material feature/workstream PR is considered merge-ready, apply the mandatory handoff protocol and update `CURRENT_WORKSTREAM_STATUS.md` in that PR. Unfinished work must record its blocker and exact next step; unfinished work is not an exception to handoff documentation.

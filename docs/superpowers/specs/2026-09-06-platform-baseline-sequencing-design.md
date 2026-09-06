# Mkety Platform Baseline Sequencing Design

## Status
Approved implementation sequence for September 2026.

## Objective
Move faster without allowing parallel feature work, deployment experiments, legacy template artifacts, or migration conflicts to fragment the Mkety architecture.

## Authoritative execution order

1. Freeze new major feature branches.
2. Finish Mkety Auth on PR #16.
3. Make the frontend continuously deployable to a safe Cloudflare preview environment immediately after Auth is stable.
4. Establish one migration and runtime baseline.
5. Rebase and secure the Automation webhook foundation on that baseline.
6. Perform repository cleansing and close/supersede stale work.
7. Resume Platform expansion from the clean baseline.

## 1. Feature freeze

Until the baseline is complete, do not begin new major Platform subsystems. Allowed work is limited to:

- Mkety Auth completion and verification.
- Cloudflare preview/deployment readiness required to inspect the frontend continuously.
- Migration/runtime baseline consolidation.
- Automation webhook rebase, security repair, and verification.
- Documentation, branch, workflow, dependency, naming, and template cleanup required by this baseline.

Small bug fixes that protect existing merged functionality are allowed. New product surface area is not.

## 2. Mkety Auth completion

PR #16 (`feat/mkety-auth-zitadel-vinext`) is the first implementation gate.

The application authentication boundary remains provider-neutral and owned by Mkety. ZITADEL is an adapter, not application architecture.

Promotion requires:

- no application dependency on Auth.js/NextAuth session APIs;
- no active Auth0/NEXTAUTH configuration path;
- Authorization Code + PKCE;
- state, issuer, audience, signature, and token validation;
- provider-neutral internal identity mapping;
- opaque application sessions with only token hashes persisted;
- tenant authorization based on authoritative membership data, not stale session role claims;
- logout revocation and cookie clearing;
- no secret/token logging;
- type-check, lint, tests, build, and auth-specific checks green;
- Cloudflare preview login, callback, session, protected-route, tenant authorization, and logout smoke tests completed.

PR #4's stale-session RBAC invariant must be carried into the Auth implementation/tests rather than merged independently.

## 3. Continuous frontend preview after Auth

Once Auth is stable, the repository must have one documented, repeatable preview path that lets the team inspect the full public and authenticated frontend while backend work continues.

Requirements:

- deploy to Cloudflare `workers.dev` or the agreed non-production Cloudflare preview hostname;
- preview deployment is explicitly non-production and never implies production promotion;
- public website routes render;
- authenticated Platform routes render;
- login/logout/session flow works against the configured preview identity provider;
- environment variables and secrets are separated from source control;
- a failed build/test/auth readiness gate prevents preview promotion;
- every subsequent major Platform slice should be testable in the deployed preview before production.

## 4. One runtime and migration baseline

The repository must not maintain ambiguous competing runtime or migration truths.

### Runtime

Document one current deployment path and one target path. If OpenNext is retained temporarily while vinext is validated, label OpenNext as transitional and vinext as target. Do not allow both to remain indefinitely without an explicit ownership boundary and removal condition.

### Database migrations

Before merging Auth or Webhooks:

- inspect the complete ordered migration sequence;
- eliminate duplicate sequence numbers;
- reconcile manual Mkety content SQL with the Drizzle migration path;
- ensure new migrations have deterministic order and documented bootstrap commands;
- make CI/smoke checks fail when migration numbering/history is inconsistent.

The known collision between `0009_mkety_auth.sql` and `0009_automation_webhook_trigger.sql` must be resolved before both features are merged.

## 5. Webhook rebase and security gate

PR #15 is rebased only after Auth/runtime/migration baseline is established.

Requirements:

- rebase onto the post-Auth baseline;
- renumber/reconcile its migration to the next valid sequence;
- preserve endpoint-ID/secret separation and HMAC-SHA256 request authentication;
- fix ciphertext tamper detection as a real security property, not by weakening the failing test;
- preserve duplicate-delivery admission/idempotency behavior;
- use the shared workflow execution service rather than introducing a parallel execution path;
- full test, type-check, lint, build, Platform smoke, and webhook security tests must pass.

## 6. Repository cleansing

Cleansing is a release gate, not optional polish.

Remove, migrate, supersede, or clearly archive anything that conflicts with the current Mkety architecture, including:

- Auth0/Auth.js/NextAuth-era docs, code paths, env names, and setup instructions;
- generic SaaS-template branding or instructions that can mislead future agents;
- temporary workflows and diagnostic artifacts no longer needed;
- stale branches/PRs whose useful architectural intent has been absorbed elsewhere;
- contradictory migration instructions;
- obsolete runtime/deployment instructions;
- legacy naming that conflicts with Mkety Platform, Mkety Academy, or Enterprise solution boundaries.

Specific stale PR handling:

- PR #1: close/recreate only if its workspace-routing behavior is still needed after Auth; do not merge the stale session-role implementation.
- PR #4: absorb its DB-backed membership/RBAC invariant into Auth tests, then close as superseded.
- PR #3: preserve the reusable managed-hosting billing architecture decision in an authoritative billing document/addendum, then close the stale PR.

## 7. Post-baseline Platform expansion

After the baseline is clean and deployable, resume Platform work. Recommended shared-infrastructure priority:

1. Billing and plan model.
2. Entitlements.
3. Usage metering and credits.
4. Additional Automation triggers/runtime capabilities.
5. Deploy and SolutionHub expansion.
6. Deeper Academy work and Enterprise solution integrations according to the master blueprint.

## Development rule

No old implementation, documentation, branch, dependency, migration, or naming convention survives merely because it existed in the template or an earlier architecture. If it conflicts with the current Mkety source of truth, it must be migrated, replaced, explicitly archived, or removed.

## Definition of baseline complete

The baseline is complete only when:

- Auth is merged after full verification and preview smoke testing;
- the frontend has a repeatable non-production Cloudflare deployment path;
- migration numbering/history is unique and reproducible;
- runtime ownership is explicit;
- Webhooks are rebased, security-correct, and green;
- stale PRs and misleading legacy docs/artifacts are cleaned;
- main is green and is the unambiguous source from which new Platform feature work branches.
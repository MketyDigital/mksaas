# Mkety Internal Mail Bootstrap Implementation Plan

> **For agentic workers:** Implement test-first. Use the PR branch, keep each change reviewable, and run verification against the exact candidate SHA before merging or deploying.

**Goal:** Provision the reserved `/mkety-ops` Mail workspace without payment, give it a private custom capacity profile, and finish first-party Mail readiness where the authorized controls permit.

**Architecture:** Add an internal-only profile marker distinct from public `MAIL_PLAN_KEYS`. Resolve it only for the tenant ID configured in `MKETY_FIRST_PARTY_MAIL_TENANT_ID` whose stored slug is exactly `mkety-ops`. Add an audited Mail Ops action that creates an explicit tenant entitlement grant and active workspace atomically. All public tenants continue through existing commercial entitlement and plan paths.

**Spec:** `docs/superpowers/specs/2026-10-04-mkety-internal-mail-bootstrap-design.md`

**Execution method:** Implement on a dedicated GitHub PR branch with tests first; merge only after exact-head checks and review; deploy the exact merged SHA through the established Mail Production workflow. Do not write directly to production tables or use payment simulation.

## Global constraints

- Never target a tenant ID or profile submitted by the browser. Resolve the reserved tenant from server configuration and verify the tenant slug.
- Require Platform Control access and `platform:plans` for provisioning. The action must not become a general free activation endpoint.
- Use the existing `tenant_entitlement_overrides` grant mechanism with a stable first-party source/reason and actor attribution. A tenant-level deny remains authoritative.
- No checkout, subscription, invoice, payment, settlement, ledger or customer plan records.
- Keep the custom profile out of `MAIL_PLAN_KEYS`, the public pricing catalog, public checkout, and customer-selectable plans. Never normalize the internal marker to Mail Starter.
- Preserve external Mail client gating, domain verification, suppression, recipient validation, the 3,000-recipient Customer Update safety ceiling, domain warmup, configured platform daily cap, queue/provider protections, and fail-closed readiness.
- Do not log SMTP secrets, generated credentials, message bodies, or sensitive DNS tokens.
- Before DNS changes, inspect current records and preserve existing mail routing. Do not replace conflicting MX records without an approved migration path.
- Respect the blocked managed-browser route. Use only supported, permitted admin controls; do not route around a blocked UI through another surface.

## Task 1: Add failing tests for the reserved internal profile

**Files:** `src/features/mail/server/commercial.test.ts`; add `src/features/mail/server/sending-policy.test.ts`; plan-related tests for usage rendering.

- Test that only the configured reserved tenant ID with exact stored slug `mkety-ops` resolves to the internal custom profile.
- Test absent configuration, wrong tenant ID, wrong slug and malformed profile marker fail closed and never resolve to a public Starter profile.
- Test public Starter, Growth and Business resolution remains unchanged.
- Test the internal profile has no commercial monthly send or Customer Update cap and reports as Internal Custom in the authenticated operator/usage UI.
- Test a public tenant at its monthly quota is still rejected.

Run the focused tests and confirm the new behavior tests fail before implementation.

## Task 2: Add fail-closed provisioning tests

**Files:** add `src/features/mail/server/admin-actions.test.ts` or extend the repository's existing Mail Ops action test suite.

Cover:
- authorized operator with `platform:plans` provisions only the configured `mkety-ops` tenant;
- missing/mismatched configuration, wrong slug, missing permission, non-operator and submitted target-ID tampering do not create state;
- repeated provisioning is idempotent and does not duplicate grants/workspaces;
- entitlement grant and workspace creation commit atomically;
- an existing tenant-level deny is not overridden and produces no workspace;
- no billing/payment/subscription/ledger write is invoked;
- audit records actor, tenant and action without including secrets.

Run these tests before changing the server action; verify each starts red for the expected reason.

## Task 3: Implement the profile and capacity behavior

**Files:** `src/features/mail/server/commercial.ts`, `src/features/mail/commercial/plans.ts`, `src/features/mail/server/sending-policy.ts`, `src/features/mail/server/usage.ts`, `src/features/mail/server/customer-update-actions.ts`, related Mail UI consumers.

- Introduce a server-only internal profile resolver separate from public commercial plan keys. Require both the configured tenant ID and database-resolved slug.
- Store or derive an internal marker without adding it to the public catalog; keep fallback/default customer plan normalization unchanged.
- For the reserved tenant, do not apply commercial monthly outbound or Customer Update quotas. Continue counting usage for observability.
- Display uncapped commercial quota clearly as **Internal Custom** / **No monthly quota** in authorized Mail Ops and workspace usage views. Ensure public pricing continues to list only the three public plans.
- Keep daily capacity admission, domain warmup, per-send recipient ceiling, readiness, suppression, provider and queue protections identical.
- Audit every `resolveTenantMailPlanKey`, `getMailCommercialPlan`, and direct `workspace.planKey` consumer so the internal marker cannot throw, leak into public UI, or silently fall back to Starter.

Run the focused tests and confirm they turn green without changing customer plan behavior.

## Task 4: Implement the operator bootstrap and Mail Ops UI

**Files:** `src/features/mail/server/admin-actions.ts`, `src/features/mail/server/admin-queries.ts`, `src/app/ops/[tenant]/platform-control/[module]/page.tsx`, related tests.

- Add an explicit **Provision internal Mail** action to Mail Ops.
- Re-run authorization inside the server action: Platform Control access, `platform:plans`, configured target ID, and exact `mkety-ops` slug.
- In one transaction, create the explicit non-billed entitlement grant and active Mail workspace with the internal custom marker. Return the current workspace on safe idempotent retry.
- Preserve tenant deny precedence. Fail closed on conflict or incomplete transaction and show a safe operator-facing result.
- Audit only successful state creation; do not emit repeated success events for no-op retries.
- Add status display for the reserved tenant so operators can distinguish missing configuration, missing grant, missing workspace and active Internal Custom state.
- Do not create a domain, mailbox, SMTP password, DNS record or enable outbound sending during bootstrap.

Run action and UI tests, then review the diff for every write path and tenant guard.

## Task 5: Run repository checks and complete review

- Run focused Mail tests, the full required repository test suite, typecheck, lint and production build.
- Run the established Mail Production preflight/smoke workflow on the candidate SHA; confirm the workflow targets the expected reserved tenant and does not alter external-client settings.
- Request code review and address actionable findings. Verify the final PR head SHA and all required checks before merge.
- Merge through the normal protected PR path only after review and checks pass.

## Task 6: Deploy and complete first-party readiness

- Deploy the exact merged main SHA using the established Mail Production workflow. Verify migration/deployment and Mail smoke results for that exact SHA.
- Confirm the reserved workspace and explicit entitlement exist using approved read-only operational diagnostics; confirm no billing artifacts were created and external clients remain disabled.
- Through permitted Mail setup controls, create or confirm the `mkety.com` domain and `info@mkety.com` mailbox. Preserve any existing `hello@` or `support@` state.
- Inspect current Cloudflare DNS before changes. Add only the Mail-generated records that are missing and non-conflicting; do not disrupt current MX routing. Re-run domain verification and enable sending only when SPF, DKIM, DMARC, MX and domain readiness all pass.
- Issue the first-party SMTP credential only after the workspace, entitlement, active mailbox and verified/enabled domain checks pass. Do not expose or log the generated secret; report where it must be stored if the authorized secret-control path is unavailable.
- Keep external customer Mail clients disabled. Record final readiness as complete only when workspace, domain, mailbox, DNS verification and sending checks have evidence. If an authorized UI/control is inaccessible or a DNS conflict blocks safe setup, stop at that boundary and report the exact remaining operator action.

## Completion evidence

Provide the merged commit SHA, exact Mail Production run, passing check results, workspace/domain/mailbox readiness, DNS verification status, sending status, external-client gate status, and any remaining user action. No production success claim is based solely on local tests or a queued deployment.

# Mkety Routine Platform Production Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add an exact-SHA, route-preserving production release for routine Mkety public-site and app-host code changes.

**Architecture:** Add a normal manual release workflow with explicit public/app/both targets, reuse existing exact-SHA gates and candidate evidence, deploy only the selected existing Worker, and run post-deploy smoke without touching DNS, Custom Domains, or Worker Routes.

**Tech Stack:** GitHub Actions, Cloudflare Workers, pnpm, Vinext, shell/Node workflow validation.

**Spec:** `docs/superpowers/specs/2026-10-21-mkety-current-truth-and-app-domain-design.md`

## Global Constraints

- Routine releases deploy verified exact main SHAs; a moving or stale SHA fails closed.
- The routine workflow never requests `CUTOVER MKETY PUBLIC`.
- The routine workflow must not mutate DNS, Worker Custom Domains, or Worker Routes.
- Public worker target is `mkety-platform`; authenticated app target is `mkety-app-host`.
- Candidate, Mail, AI, and repair workflows retain their distinct purposes.

## Review Focus

- Stale main SHA during authorization — fail before mutation.
- Wrong surface-to-worker mapping — assert target name before deploy.
- Missing candidate/CI evidence — workflow authorization fails closed.
- Accidental routing mutation — regression test rejects DNS/route/Custom Domain API calls.
- App auth binding regression — app-target smoke requires the established auth bindings.

---

### Task 1: Add a regression test for the ordinary release contract

**Files:**
- Create: `src/features/deploy/platform-production-release.test.ts`
- Test: `src/features/deploy/platform-production-release.test.ts`

**Interfaces:**
- Produces: test assertions for workflow SHA gate, surface mapping, and no-routing-mutation invariant.

- [ ] **Step 1: Write tests** that read the new workflow and assert exact 40-character SHA/main-head equality, authorized `public`/`app`/`both` target mapping, and the absence of DNS, Worker Route, or Custom Domain mutation endpoints.
- [ ] **Step 2: Run** `pnpm exec jest src/features/deploy/platform-production-release.test.ts --runInBand`; confirm it fails because the workflow is absent.
- [ ] **Step 3: Keep the test contract specific** to the exact worker names `mkety-platform` and `mkety-app-host`.

### Task 2: Implement the route-preserving exact-SHA workflow

**Files:**
- Create: `.github/workflows/mkety-platform-production-release.yml`
- Modify: `src/features/deploy/platform-production-release.test.ts`

**Interfaces:**
- Consumes: existing quality workflows, `mkety-public-candidate-deploy.yml`, existing Cloudflare deploy scripts, current Worker names.
- Produces: `workflow_dispatch` inputs `verified_sha`, `surface`, and confirmation `DEPLOY MKETY PLATFORM`.

- [ ] **Step 1: Authorize the exact SHA** only if it is the current `main` head and all applicable tests, typecheck, lint, build, migration-baseline and candidate proof gates passed for that SHA.
- [ ] **Step 2: Deploy the requested target(s)**: `public` to `mkety-platform`, `app` to `mkety-app-host`, or `both` to both. Preserve existing bindings and secrets; do not run domain or route APIs.
- [ ] **Step 3: Add post-deploy smoke** for the selected public routes and/or authenticated app health/login contract; fail on missing expected bindings or response checks.
- [ ] **Step 4: Run the contract test** and expect PASS.

### Task 3: Document the operator path

**Files:**
- Modify: `docs/DEPLOYMENT.md`
- Modify: `docs/README.md`

- [ ] **Step 1: Document** how to select the verified SHA/surface, evidence requirements, smoke checks, rollback target, and the fact that ordinary releases preserve domain routing.
- [ ] **Step 2: Distinguish** the routine release from public candidate, Mail/AI releases, app-host repair, and one-time cutover.
- [ ] **Step 3: Run the focused Jest test, typecheck, workflow YAML validation, and the repository's applicable CI checks.**

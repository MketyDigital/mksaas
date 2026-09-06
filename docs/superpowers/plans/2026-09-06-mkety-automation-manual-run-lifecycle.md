# Mkety Automation Manual Run Lifecycle Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add guarded manual workflow run records and a safe no-op orchestration lifecycle without dispatching workflow actions.

**Architecture:** Reuse the existing `workflow_runs` persistence and workflow preflight result. Add a pure helper that gates execution readiness and produces a side-effect-free inspection output, then expose one manager-only server action and builder form. The existing full runtime stays disconnected from this builder surface.

**Tech Stack:** Next.js, React, TypeScript, Drizzle ORM, Vitest, Testing Library, PostgreSQL, pnpm.

**Spec:** `docs/superpowers/specs/2026-09-06-mkety-automation-manual-run-lifecycle-design.md`

## Global Constraints

- No action dispatch or external provider calls.
- No webhook/scheduler activation.
- No retries, credentials, OAuth, billing, deployment automation or trading runtime.
- Manual admission must be tenant/project/workflow scoped and manager gated.
- Preflight must be re-evaluated on the server immediately before run creation.
- Existing lower-level `executeWorkflow()` must not be called.

---

### Task 1: Add pure manual-run foundation helpers

**Files:**
- Create: `src/features/projects/workspaces/automation/manual-run-foundation.ts`
- Test: `src/features/projects/workspaces/automation/manual-run-foundation.test.ts`

**Interfaces:**
- `assertManualRunPreflightReady(preflight)` rejects any errors or warnings.
- `buildManualRunNoopOutput({ definition, workflowVersion })` returns inspection-only run output.

- [ ] Test ready and unready preflight admission.
- [ ] Test deterministic inspection output and prove runtime dispatch remains false.
- [ ] Implement only pure read-only helpers.

### Task 2: Add manager-only manual-run form

**Files:**
- Create: `src/features/projects/workspaces/automation/AutomationWorkflowManualRunForm.tsx`
- Test: `src/features/projects/workspaces/automation/AutomationWorkflowManualRunForm.test.tsx`

**Interfaces:**
- Consumes manager permission, tenant/project/workflow slugs and preflight.
- Posts to `startAutomationWorkflowManualRun`.

- [ ] Render enabled action only for manager + clean preflight.
- [ ] Disable run request for unready preflight.
- [ ] Preserve protected non-manager boundary.
- [ ] Render no retry, webhook or action-dispatch controls.

### Task 3: Add guarded lifecycle server action

**Files:**
- Modify: `src/features/projects/workspaces/automation/actions.ts`

**Interfaces:**
- Adds `startAutomationWorkflowManualRun(formData)`.

- [ ] Reuse `getManageableWorkflow` tenant/project scoping.
- [ ] Re-run preflight server-side.
- [ ] Refuse when a `queued` or `running` workflow run already exists.
- [ ] Insert `queued`, update to `running`, then finish `completed` with safe-noop output.
- [ ] Record `failed`, error and `completedAt` on lifecycle failure.
- [ ] Never call the full workflow runtime.

### Task 4: Wire the builder surface

**Files:**
- Modify: `src/app/(tenant)/t/[tenant]/projects/[project]/automation/[workflow]/page.tsx`

- [ ] Render the manual run panel immediately after preflight.
- [ ] Pass only existing scoped snapshot/preflight data.

### Task 5: Extend focused verification

**Files:**
- Modify: `.github/workflows/mkety-platform-core-workspaces-smoke.yml`

- [ ] Add manual-run helper and form tests.
- [ ] Run focused tests and type-check in smoke.
- [ ] Use available GitHub Actions for full tests, lint, type-check and build after the single batch push.

# Mkety Automation Workflow Draft Validation / Preflight Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add deterministic read-only workflow preflight validation and surface it in the Automation builder without enabling runtime behavior.

**Architecture:** Validate the raw workflow definition with one pure helper after the existing tenant/project-scoped workflow lookup. Pass only structured preflight results into a dedicated read-only UI panel so Automation stays independent from AI/resource resolution and the builder never needs raw definition JSON.

**Tech Stack:** Next.js, React, TypeScript, Drizzle ORM, Vitest, Testing Library, pnpm.

**Spec:** `docs/superpowers/specs/2026-09-06-mkety-automation-workflow-preflight-design.md`

## Global Constraints

- Automation remains independent from the AI workspace; agent references are validated structurally only.
- No workflow execution, webhook/scheduler activation, HTTP calls, agent execution, transform/condition evaluation, variable interpolation, retries, credentials, publishing, billing, deployment automation, or trading runtime.
- Validation is read-only and must not mutate workflow definitions.
- Tenant/project isolation remains in the existing builder data lookup.

---

### Task 1: Pure preflight validator

**Files:**
- Create: `src/features/projects/workspaces/automation/workflow-preflight.ts`
- Test: `src/features/projects/workspaces/automation/workflow-preflight.test.ts`

**Interfaces:**
- Produces `validateAutomationWorkflowDefinition(definition: unknown): AutomationWorkflowPreflightResult`.
- Produces structured checks with `severity`, `code`, `message`, and optional `nodeId`.

- [ ] Add tests for a fully prepared definition, missing/duplicate IDs, missing or multiple triggers, unsupported nodes, and each supported node type's required draft fields.
- [ ] Verify URL and enum checks are structural only and make no external calls.
- [ ] Implement aggregate error/warning/ready counts and `readyForExecutionFoundation`.

### Task 2: Read-only preflight panel

**Files:**
- Create: `src/features/projects/workspaces/automation/AutomationWorkflowPreflightPanel.tsx`
- Test: `src/features/projects/workspaces/automation/AutomationWorkflowPreflightPanel.test.tsx`

**Interfaces:**
- Consumes `AutomationWorkflowPreflightResult`.

- [ ] Render overall readiness plus all three severity counts.
- [ ] Render exact check messages and node IDs.
- [ ] Render no Run, Activate, Retry, Publish, credential, or provider controls.

### Task 3: Builder data wiring

**Files:**
- Modify: `src/features/projects/workspaces/automation/data.ts`
- Modify: `src/app/(tenant)/t/[tenant]/projects/[project]/automation/[workflow]/page.tsx`

**Interfaces:**
- Extend `AutomationBuilderSnapshot` with `preflight`.
- Calculate preflight from `workflow.definition` only after the tenant/project/workflow-scoped database lookup succeeds.

- [ ] Keep the existing workflow and recent-runs queries unchanged in scope.
- [ ] Pass structured preflight to the panel without exposing raw workflow JSON to the UI.

### Task 4: Focused verification coverage

**Files:**
- Modify: `.github/workflows/mkety-platform-core-workspaces-smoke.yml`

- [ ] Add validator and panel tests to focused smoke coverage.
- [ ] Run focused tests, type-check, lint, and build when runner capacity is available.
- [ ] Do not mark the PR ready or merge until real verification passes.

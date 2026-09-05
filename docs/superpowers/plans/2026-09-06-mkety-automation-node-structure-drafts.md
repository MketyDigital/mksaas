# Mkety Automation Workflow Structure Draft Editing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add safe manager-only move, duplicate, and delete operations for supported Automation workflow draft nodes.

**Architecture:** Add one pure structure transformer that preserves the raw workflow definition and applies one explicit operation to one uniquely identified supported node. Route mutations through the existing tenant/project manager boundary and render simple form controls in the existing builder rather than introducing drag-and-drop state.

**Tech Stack:** Next.js, React, TypeScript, Drizzle ORM, Vitest, Testing Library, pnpm.

**Spec:** `docs/superpowers/specs/2026-09-06-mkety-automation-node-structure-drafts-design.md`

## Global Constraints

- No workflow execution or action dispatch.
- No webhook or scheduler activation.
- No credentials, secrets, OAuth, provider calls, retries, publishing, billing, deployment automation, or trading runtime.
- Unknown/future nodes must be preserved and remain inspection-only.
- Every structure mutation must preserve definition-level and unrelated node data.

---

### Task 1: Add pure structure-draft transformer

**Files:**
- Create: `src/features/projects/workspaces/automation/workflow-node-structure-drafts.ts`
- Test: `src/features/projects/workspaces/automation/workflow-node-structure-drafts.test.ts`

**Interfaces:**
- Produces `buildWorkflowDefinitionWithNodeStructureDraft({ currentDefinition, nodeId, operation })`.
- `operation` is `move-up | move-down | duplicate | delete`.

- [ ] Test move-up and move-down while preserving unknown nodes and metadata.
- [ ] Test duplicate full-node preservation and collision-safe IDs.
- [ ] Test exact-node deletion.
- [ ] Test missing, ambiguous, unsupported, and boundary-operation rejection.
- [ ] Implement the minimal pure transformer.

### Task 2: Add manager-only structure controls

**Files:**
- Create: `src/features/projects/workspaces/automation/AutomationWorkflowNodeStructureDraftForm.tsx`
- Test: `src/features/projects/workspaces/automation/AutomationWorkflowNodeStructureDraftForm.test.tsx`

**Interfaces:**
- Consumes `AutomationBuilderNodeSummary[]`.
- Posts `nodeId` and `operation` to `updateAutomationWorkflowNodeStructureDraft`.

- [ ] Render controls only for supported configurable nodes.
- [ ] Hide impossible move-up/move-down controls at boundaries.
- [ ] Keep unknown nodes inspection-only.
- [ ] Keep all runtime controls absent.

### Task 3: Add server action and builder wiring

**Files:**
- Modify: `src/features/projects/workspaces/automation/actions.ts`
- Modify: `src/app/(tenant)/t/[tenant]/projects/[project]/automation/[workflow]/page.tsx`

**Interfaces:**
- Adds `updateAutomationWorkflowNodeStructureDraft(formData)`.

- [ ] Preserve project access and manager authorization.
- [ ] Scope workflow lookup by tenant/project/workflow.
- [ ] Update only `definition` and `updatedAt`.
- [ ] Render structure controls after the existing node configuration editor.

### Task 4: Extend focused verification

**Files:**
- Modify: `.github/workflows/mkety-platform-core-workspaces-smoke.yml`

- [ ] Add structure helper and form tests to focused smoke coverage.
- [ ] Run focused tests, type-check, lint, and build when runner capacity is available.
- [ ] Do not mark PR ready or merge until real verification passes.

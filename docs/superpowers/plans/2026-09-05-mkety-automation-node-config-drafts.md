# Mkety Automation Node Configuration Draft Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add safe, manager-only node metadata drafts while making draft-node append non-destructive.

**Architecture:** Keep workflow configuration inside the existing JSON `definition`. Preserve unknown data structurally, expose only `label` and `notes` for supported nodes with stable IDs, and route all mutations through existing tenant/project access checks.

**Tech Stack:** Next.js, React, TypeScript, Drizzle ORM, Vitest, Testing Library, pnpm.

**Spec:** `docs/superpowers/specs/2026-09-05-mkety-automation-node-config-drafts-design.md`

## Global Constraints

- No workflow execution or action dispatch.
- No webhook activation or trigger scheduling.
- No credentials, secrets, OAuth, or provider integrations.
- No retry execution, publishing, billing, deployment automation, or trading runtime.
- Preserve existing workflow-definition data on every draft mutation.

---

### Task 1: Make draft-node append non-destructive

**Files:**
- Modify: `src/features/projects/workspaces/automation/workflow-node-drafts.ts`
- Test: `src/features/projects/workspaces/automation/workflow-node-drafts.test.ts`

**Interfaces:**
- Consumes: existing workflow `definition` and a supported node type.
- Produces: `buildWorkflowDefinitionWithDraftNode()` that preserves the existing definition and appends one uniquely identified draft node.

- [ ] Add regression tests for unknown nodes, extra metadata, definition metadata, and ID collisions.
- [ ] Preserve the raw existing `nodes` array instead of filtering it through the current supported-node schema.
- [ ] Generate a deterministic non-colliding node ID.
- [ ] Keep unsupported new node types rejected.

### Task 2: Add safe config-draft transformation

**Files:**
- Create: `src/features/projects/workspaces/automation/workflow-node-config-drafts.ts`
- Test: `src/features/projects/workspaces/automation/workflow-node-config-drafts.test.ts`

**Interfaces:**
- Produces: `buildWorkflowDefinitionWithNodeConfigDraft({ currentDefinition, nodeId, label, notes })`.

- [ ] Verify exactly one node matches the requested stable ID.
- [ ] Reject unsupported target node types.
- [ ] Preserve all non-target nodes, definition metadata, node metadata, and unrelated config keys.
- [ ] Normalize `label` and `notes`; remove only those keys when cleared.

### Task 3: Expose safe editable node summaries

**Files:**
- Modify: `src/features/projects/workspaces/automation/workflow-nodes.ts`
- Test: `src/features/projects/workspaces/automation/workflow-nodes.test.ts`
- Modify: `src/features/projects/workspaces/automation/AutomationBuilderShell.test.tsx`

**Interfaces:**
- Extends `WorkflowNodeSummary` with `canConfigure` and a safe `configDraft` containing only `label` and `notes`.

- [ ] Mark only supported nodes with stable IDs as configurable.
- [ ] Never expose arbitrary config values through `configDraft`.
- [ ] Update typed builder fixtures.

### Task 4: Add manager-only node config draft forms and action

**Files:**
- Create: `src/features/projects/workspaces/automation/AutomationWorkflowNodeConfigDraftForm.tsx`
- Test: `src/features/projects/workspaces/automation/AutomationWorkflowNodeConfigDraftForm.test.tsx`
- Modify: `src/features/projects/workspaces/automation/actions.ts`
- Modify: `src/app/(tenant)/t/[tenant]/projects/[project]/automation/[workflow]/page.tsx`

**Interfaces:**
- Produces server action `updateAutomationWorkflowNodeConfigDraft(formData)`.
- Form consumes `AutomationBuilderNodeSummary[]` and posts one selected node ID plus `label` and `notes`.

- [ ] Keep non-managers read-only.
- [ ] Update only workflow `definition` and `updatedAt`.
- [ ] Preserve tenant/project/workflow scoping.
- [ ] Render no runtime, credential, activation, or execution controls.

### Task 5: Extend focused verification

**Files:**
- Modify: `.github/workflows/mkety-platform-core-workspaces-smoke.yml`

- [ ] Add the node config helper and form tests to the focused smoke command.
- [ ] Run focused tests, `pnpm type-check`, `pnpm lint`, and `pnpm build` once Actions capacity is available or equivalent local verification is possible.
- [ ] Do not mark the PR ready or merge until verification produces real passing steps.

# Mkety Automation Type-Specific Node Configuration Drafts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add validated, type-specific Automation node configuration drafts without enabling runtime behavior.

**Architecture:** Extend the existing node-config draft transformer and form rather than create a parallel editor. The transformer whitelists fields by node type, preserves unrelated definition data, and the builder summary exposes only the safe draft values required to prefill the editor.

**Tech Stack:** Next.js, React, TypeScript, Drizzle ORM, Vitest, Testing Library, pnpm.

**Spec:** `docs/superpowers/specs/2026-09-06-mkety-automation-typed-node-config-drafts-design.md`

## Global Constraints

- No workflow execution or action dispatch.
- No webhook or scheduler activation.
- No credentials, secrets, OAuth, provider calls, retries, publishing, billing, deployment automation, or trading runtime.
- Every draft mutation must preserve unknown/future definition data.

---

### Task 1: Extend the node config transformer

**Files:**
- Modify: `src/features/projects/workspaces/automation/workflow-node-config-drafts.ts`
- Test: `src/features/projects/workspaces/automation/workflow-node-config-drafts.test.ts`

**Interfaces:**
- Extend `buildWorkflowDefinitionWithNodeConfigDraft()` with optional type-specific string fields.
- Preserve the existing required `currentDefinition`, `nodeId`, `label`, and `notes` inputs.

- [ ] Add tests proving agent, HTTP, transform, condition, and trigger draft fields are normalized and stored only on matching node types.
- [ ] Add tests for invalid HTTP methods, non-HTTP(S) URLs, invalid trigger modes, invalid condition operators, and oversized values.
- [ ] Implement field limits and enum validation.
- [ ] Preserve unrelated config and definition metadata.

### Task 2: Expose safe typed draft values in builder summaries

**Files:**
- Modify: `src/features/projects/workspaces/automation/workflow-nodes.ts`
- Test: `src/features/projects/workspaces/automation/workflow-nodes.test.ts`
- Modify fixture: `src/features/projects/workspaces/automation/AutomationBuilderShell.test.tsx`

**Interfaces:**
- Add `typeConfigDraft` to `WorkflowNodeSummary` with only approved string fields.

- [ ] Extract only whitelisted draft values from config.
- [ ] Keep arbitrary config values hidden from the typed draft surface.
- [ ] Update typed fixtures.

### Task 3: Render type-specific draft controls

**Files:**
- Modify: `src/features/projects/workspaces/automation/AutomationWorkflowNodeConfigDraftForm.tsx`
- Test: `src/features/projects/workspaces/automation/AutomationWorkflowNodeConfigDraftForm.test.tsx`

**Interfaces:**
- Continue posting to `updateAutomationWorkflowNodeConfigDraft`.
- Render controls according to `node.type` and `node.typeConfigDraft`.

- [ ] Add trigger, agent, HTTP, transform, and condition fields.
- [ ] Keep runtime/credential/activation controls absent.
- [ ] Keep non-manager boundary unchanged.

### Task 4: Pass typed draft values through the server action

**Files:**
- Modify: `src/features/projects/workspaces/automation/actions.ts`

**Interfaces:**
- Pass all whitelisted form values to `buildWorkflowDefinitionWithNodeConfigDraft()`; the helper decides which fields belong to the target node type.

- [ ] Preserve tenant/project/workflow scoping and manager authorization.
- [ ] Continue updating only `definition` and `updatedAt`.

### Task 5: Focused verification

**Files:**
- Existing workflow: `.github/workflows/mkety-platform-core-workspaces-smoke.yml`

- [ ] Keep the existing node-config helper and form tests in the focused smoke command.
- [ ] Run focused tests, type-check, lint, and build when runner capacity is available.
- [ ] Do not mark the PR ready or merge until real verification passes.

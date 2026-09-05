# Mkety Automation Data Model Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only Automation Workspace backend-facing foundation using existing workflow and run records without enabling live automation execution.

**Architecture:** Reuse the existing `workflows` and `workflow_runs` schema. Add a pure metrics helper, a server snapshot loader, and UI wiring that displays tenant/project-scoped summaries while keeping all execution controls disabled.

**Tech Stack:** Next.js App Router, React, TypeScript, Drizzle ORM, Jest, Testing Library, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-05-mkety-automation-data-model-foundation-design.md`

## Global Constraints

- Do not add duplicate workflow, workflow run, webhook, or execution tables.
- Do not enable live workflow execution.
- Do not expose Run, Retry, Activate Webhook, or Publish automation controls.
- Keep `executionEnabled` false.
- Keep Automation tenant-scoped and project-scoped through existing access guards.
- Do not touch billing, deployment automation, or trading runtime.

---

### Task 1: Pure Automation Metrics

**Files:**
- Create: `src/features/projects/workspaces/automation/automation-model.test.ts`
- Create: `src/features/projects/workspaces/automation/automation-model.ts`

**Interfaces:**
- Produces: `buildAutomationWorkspaceMetrics({ workflows, runs }): AutomationWorkspaceMetrics`

- [x] **Step 1: Write the failing test**

```ts
const metrics = buildAutomationWorkspaceMetrics({
  workflows: [
    { status: 'draft', triggerType: 'manual' },
    { status: 'active', triggerType: 'schedule' },
  ],
  runs: [{ status: 'failed' }],
});
expect(metrics.executionEnabled).toBe(false);
```

- [x] **Step 2: Implement the helper**

```ts
export function buildAutomationWorkspaceMetrics({ workflows, runs }) {
  return {
    workflowCount: workflows.length,
    draftWorkflowCount: workflows.filter((workflow) => workflow.status === 'draft').length,
    activeWorkflowCount: workflows.filter((workflow) => workflow.status === 'active').length,
    webhookWorkflowCount: workflows.filter((workflow) => workflow.triggerType === 'webhook').length,
    runCount: runs.length,
    failedRunCount: runs.filter((run) => run.status === 'failed').length,
    executionEnabled: false,
  };
}
```

- [x] **Step 3: Commit**

```bash
git add src/features/projects/workspaces/automation/automation-model.*
git commit -m "feat: add automation workspace model metrics"
```

### Task 2: Read-only Snapshot Loader

**Files:**
- Create: `src/features/projects/workspaces/automation/data.ts`

**Interfaces:**
- Consumes: `buildAutomationWorkspaceMetrics`
- Produces: `getAutomationWorkspaceSnapshot({ tenantId, projectId })`

- [x] **Step 1: Implement the loader**

```ts
const [projectWorkflows, projectRuns] = await Promise.all([
  db.query.workflows.findMany({ where: and(eq(workflows.tenantId, tenantId), eq(workflows.projectId, projectId)), limit: 6 }),
  db.query.workflowRuns.findMany({ where: and(eq(workflowRuns.tenantId, tenantId), eq(workflowRuns.projectId, projectId)), limit: 6 }),
]);
```

- [x] **Step 2: Return display-safe summaries**

```ts
return {
  metrics: buildAutomationWorkspaceMetrics({ workflows: projectWorkflows, runs: projectRuns }),
  recentWorkflows: projectWorkflows.map(...),
  recentRuns: projectRuns.map(...),
};
```

- [x] **Step 3: Commit**

```bash
git add src/features/projects/workspaces/automation/data.ts
git commit -m "feat: add automation workspace snapshot loader"
```

### Task 3: Automation Overview Wiring

**Files:**
- Modify: `src/features/projects/workspaces/AutomationWorkspaceOverview.tsx`
- Modify: `src/app/(tenant)/t/[tenant]/projects/[project]/automation/page.tsx`

**Interfaces:**
- Consumes: `AutomationWorkspaceSnapshot`
- Produces: read-only Automation Workspace UI metrics.

- [x] **Step 1: Update overview props**

```ts
export function AutomationWorkspaceOverview({ snapshot = emptyAutomationWorkspaceSnapshot, ... })
```

- [x] **Step 2: Show read-only counts and recent records**

```tsx
<p>{metrics.workflowCount}</p>
<p>Workflows</p>
```

- [x] **Step 3: Wire route loader**

```ts
const snapshot = await getAutomationWorkspaceSnapshot({ projectId: access.project.id, tenantId: access.tenant.id });
```

- [x] **Step 4: Commit**

```bash
git add src/app/(tenant)/t/[tenant]/projects/[project]/automation/page.tsx src/features/projects/workspaces/AutomationWorkspaceOverview.tsx
git commit -m "feat: show automation workspace model metrics"
```

### Task 4: Tests and CI

**Files:**
- Modify: `src/features/projects/workspaces/AutomationWorkspaceOverview.test.tsx`
- Modify: `.github/workflows/mkety-platform-core-workspaces-smoke.yml`

**Interfaces:**
- Consumes: overview and metrics helper.

- [x] **Step 1: Add overview coverage for read-only metrics**

```ts
expect(screen.getByText('Execution disabled')).toBeInTheDocument();
expect(screen.queryByRole('button', { name: /Run workflow/i })).not.toBeInTheDocument();
```

- [x] **Step 2: Add metrics test to focused smoke**

```yaml
pnpm test -- ... src/features/projects/workspaces/automation/automation-model.test.ts
```

- [x] **Step 3: Verify**

```bash
pnpm test
pnpm type-check
pnpm lint
pnpm build
```

- [ ] **Step 4: Update PR and merge after CI passes**

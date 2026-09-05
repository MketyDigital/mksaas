# Mkety Automation Builder Shell Spec

## Context

PR #9 introduced the Automation Workspace data-model foundation by reusing existing `workflows` and `workflow_runs` tables, displaying project-scoped counts, and keeping `executionEnabled` false.

The next safe step is a read-only builder shell for individual workflow records. This gives `app.mkety.com` a place to inspect workflow definitions before visual editing, live execution, scheduling, webhooks, retries, or publishing are implemented.

## Goals

- Add a route for individual workflow records under the Automation Workspace.
- Display workflow identity, status, trigger type, version, node count, and definition readiness.
- Display workflow definition nodes from the existing `definition.nodes` JSON shape.
- Display recent run records for the selected workflow.
- Link recent workflows from the Automation overview to the read-only builder shell.
- Preserve tenant/project access checks.
- Keep all execution and activation behavior disabled.

## Route

```text
/t/[tenant]/projects/[project]/automation/[workflow]
```

`[workflow]` is the workflow slug scoped to the current tenant and project.

## Read-only surfaces

- Builder header
- Workflow status summary
- Definition readiness
- Node list
- Recent run records
- Back link to Automation Workspace

## Explicit non-goals

- No workflow execution engine.
- No trigger scheduling.
- No webhook activation.
- No action dispatch.
- No retry execution.
- No visual drag-and-drop builder.
- No workflow mutation forms.
- No billing, wallet, credits, usage deduction, deployment automation, or trading runtime.

## Safety boundary

The builder shell may inspect workflow definitions and historical run records, but must not expose controls named or behaving like Run, Retry, Activate, Publish, Deploy, or Connect webhook.

## Verification

Focused workspace smoke must include:

```bash
pnpm test -- src/features/projects/workspaces/automation/AutomationBuilderShell.test.tsx
pnpm type-check
```

Full CI must pass before merge:

```bash
pnpm test
pnpm lint
pnpm type-check
pnpm build
```

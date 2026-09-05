# Mkety Automation Builder Shell Plan

## Branch

`feat/mkety-automation-builder-shell`

## Scope

Build a read-only workflow builder/detail shell on top of the Automation data-model foundation merged in PR #9.

## Implementation checklist

- [x] Add `AutomationBuilderShell` component with read-only readiness, node, and run-record display.
- [x] Add tests proving execution, activation, retry, and publish controls are not exposed.
- [x] Add `getAutomationBuilderSnapshot` server loader scoped by tenant, project, and workflow slug.
- [x] Add `/t/[tenant]/projects/[project]/automation/[workflow]` route.
- [x] Link recent workflow records from Automation overview to the read-only builder shell.
- [x] Update focused workspace smoke workflow to include builder-shell tests.
- [ ] Open draft PR.
- [ ] Verify focused workspace smoke.
- [ ] Verify full CI.
- [ ] Mark PR ready and merge.

## Boundaries

- No workflow execution engine.
- No scheduler.
- No webhook activation.
- No action runner.
- No retry engine.
- No workflow mutation forms.
- No deployment, billing, wallet, credits, usage, or trading runtime changes.

## Expected verification

```bash
pnpm test -- src/features/projects/workspaces/registry.test.ts src/features/projects/workspaces/WorkspaceHub.test.tsx src/features/projects/workspaces/WorkspaceShell.test.tsx src/features/projects/workspaces/AiWorkspaceOverview.test.tsx src/features/projects/workspaces/AutomationWorkspaceOverview.test.tsx src/features/projects/workspaces/DeployWorkspaceOverview.test.tsx src/features/projects/workspaces/SolutionHubWorkspaceOverview.test.tsx src/features/projects/workspaces/TradingWorkspaceOverview.test.tsx src/features/projects/workspaces/automation/automation-model.test.ts src/features/projects/workspaces/automation/AutomationBuilderShell.test.tsx
pnpm type-check
pnpm test
pnpm lint
pnpm build
```

# Mkety Automation Workflow Draft Shell Spec

## Goal

Add the first safe workflow creation surface for Automation Workspace.

The feature should let tenant managers create a workflow **draft record** from the Automation Workspace and open it in the existing read-only builder shell.

## Scope

- Create workflow draft helper functions.
- Normalize workflow names into stable slugs.
- Create manual draft workflows using the existing `workflows` table.
- Use an empty workflow definition by default.
- Gate draft creation to project managers/admins through existing project access rules.
- Redirect successful draft creation to `/t/[tenant]/projects/[project]/automation/[workflow]`.
- Render a draft creation form in the Automation Workspace.
- Render a read-only permission boundary for non-managers.
- Add focused smoke coverage.

## Boundaries

- No workflow execution engine.
- No trigger scheduling.
- No webhook activation.
- No action dispatch.
- No retry execution.
- No visual drag-and-drop builder.
- No workflow mutation/editing beyond initial draft creation.
- No billing, wallet, credits, usage deduction, deployment automation, or trading runtime.

## Default draft state

- `status`: `draft`
- `triggerType`: `manual`
- `version`: `1`
- `definition`: `{ nodes: [] }`

## Success criteria

- Managers/admins can see a draft creation form.
- Non-managers see a clear boundary message.
- Created records stay draft-only.
- The read-only builder shell remains the next destination.
- Focused smoke and full CI pass.
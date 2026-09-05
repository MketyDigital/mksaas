# Mkety Automation Manual Node Draft Add Shell — Implementation Plan

## Completed steps

1. Added draft-node helper tests.
2. Added `buildWorkflowDefinitionWithDraftNode` with supported node-type validation.
3. Added manager-gated `addAutomationWorkflowDraftNode` server action.
4. Added draft-node form tests.
5. Added `AutomationWorkflowDraftNodeForm`.
6. Wired the form into `/t/[tenant]/projects/[project]/automation/[workflow]`.
7. Expanded focused workspace smoke coverage.

## Verification targets

- Focused workspace smoke.
- Full test suite.
- Full lint.
- Full type-check.
- Full build.

## Explicit non-goals

- Do not execute workflows.
- Do not activate webhooks.
- Do not dispatch actions.
- Do not configure credentials or secrets.
- Do not add node configuration editing.
- Do not add visual drag-and-drop building.
- Do not touch billing, deployment, or trading runtime.

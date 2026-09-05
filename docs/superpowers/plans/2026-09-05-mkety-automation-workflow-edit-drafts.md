# Mkety Automation Workflow Edit Draft Shell — Implementation Plan

## Completed steps

1. Added metadata edit helper tests.
2. Added `buildWorkflowMetadataUpdateInput` for name and description only.
3. Added manager-gated `updateAutomationWorkflowMetadata` server action.
4. Added metadata edit form tests.
5. Added `AutomationWorkflowMetadataForm`.
6. Wired the form into `/t/[tenant]/projects/[project]/automation/[workflow]`.
7. Expanded focused workspace smoke coverage.

## Verification targets

- Focused workspace smoke.
- Full test suite.
- Full lint.
- Full type-check.
- Full build.

## Explicit non-goals

- Do not edit workflow nodes.
- Do not edit triggers.
- Do not execute workflows.
- Do not activate webhooks.
- Do not publish workflows.
- Do not dispatch actions.
- Do not touch billing, deployment, or trading runtime.

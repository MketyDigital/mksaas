# Mkety Automation Node Draft Inspection/Preparation — Implementation Plan

## Completed steps

1. Added node-preparation helper tests.
2. Added `buildWorkflowNodeSummaries` and `WorkflowNodeSummary`.
3. Refactored Automation builder data loading to use the node preparation helper.
4. Updated the builder shell to display prepared-node and needs-review counts.
5. Updated the node list to show readiness labels per node.
6. Expanded builder-shell tests for prepared and needs-review nodes.
7. Expanded focused workspace smoke coverage.

## Verification targets

- Focused workspace smoke.
- Full test suite.
- Full lint.
- Full type-check.
- Full build.

## Explicit non-goals

- Do not add node mutation forms.
- Do not add a visual builder.
- Do not execute workflows.
- Do not activate webhooks.
- Do not publish workflows.
- Do not dispatch actions.
- Do not touch billing, deployment, or trading runtime.

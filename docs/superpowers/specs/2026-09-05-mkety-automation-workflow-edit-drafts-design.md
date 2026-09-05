# Mkety Automation Workflow Edit Draft Shell — Design Spec

## Goal

Allow managers to safely edit Automation workflow draft metadata after a workflow draft has been created.

This phase keeps editing intentionally narrow: workflow name and description only.

## In scope

- Add a metadata-normalization helper for workflow edit input.
- Add a manager-gated server action for workflow name and description updates.
- Keep updates scoped by tenant, project, and workflow slug.
- Add a metadata-only edit form to the Automation Builder route.
- Show non-manager boundary copy instead of a form.
- Add focused tests and focused smoke coverage.

## Out of scope

- No workflow execution engine.
- No trigger scheduling.
- No webhook activation.
- No action dispatch.
- No retry execution.
- No visual drag-and-drop builder.
- No node editing.
- No trigger editing.
- No status publishing.
- No billing, wallet, credits, deployment automation, or trading runtime.

## Safety model

The edit action must not accept or write workflow definition, trigger type, runtime status, action configuration, webhook state, run state, or publish state. Those remain protected for later backend/runtime slices.

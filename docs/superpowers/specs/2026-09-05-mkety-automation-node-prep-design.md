# Mkety Automation Node Draft Inspection/Preparation — Design Spec

## Goal

Prepare Automation workflow nodes for future safe editing by introducing a reusable inspection helper and clearer node readiness presentation.

This phase is intentionally read-only. It improves how workflow definitions are interpreted and displayed, without changing workflow definitions or executing anything.

## In scope

- Add a pure node-summary helper for workflow definitions.
- Recognize the currently supported node types: trigger, agent, http, transform, and condition.
- Normalize malformed node ids and missing node types for inspection.
- Mark unsupported or malformed nodes as `Needs review`.
- Reuse the helper in the Automation builder snapshot loader.
- Show prepared-node and needs-review counts inside the builder shell.
- Show each node readiness label in the read-only node list.
- Add focused tests and focused smoke coverage.

## Out of scope

- No workflow execution engine.
- No trigger scheduling.
- No webhook activation.
- No action dispatch.
- No retry execution.
- No visual drag-and-drop builder.
- No node creation.
- No node editing.
- No node deletion.
- No trigger editing.
- No status publishing.
- No billing, wallet, credits, deployment automation, or trading runtime.

## Safety model

The helper must produce display-only node summaries. It must not return executable handlers, editable mutation payloads, provider credentials, webhook activation data, or runtime dispatch instructions.

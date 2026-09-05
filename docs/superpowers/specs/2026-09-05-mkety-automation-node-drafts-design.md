# Mkety Automation Manual Node Draft Add Shell — Design Spec

## Goal

Allow managers to append a supported placeholder node to an Automation workflow draft definition.

This phase prepares workflow structure only. It does not create a visual builder, execute nodes, activate triggers, configure credentials, dispatch actions, or publish workflows.

## In scope

- Add a pure helper for appending one supported draft node to a workflow definition.
- Support the current workflow node types: `trigger`, `agent`, `http`, `transform`, and `condition`.
- Generate deterministic placeholder node IDs from node type and position.
- Add a manager-gated server action for appending draft nodes.
- Update only workflow `definition` and `updatedAt`.
- Add a draft-node form to the Automation Builder route.
- Add focused tests and smoke coverage.

## Out of scope

- No workflow execution engine.
- No trigger scheduling.
- No webhook activation.
- No action dispatch.
- No retry execution.
- No visual drag-and-drop builder.
- No node configuration editing.
- No node deletion.
- No trigger editing.
- No credentials, secrets, or provider integrations.
- No publish/status editing.
- No billing, wallet, credits, deployment automation, or trading runtime.

## Safety model

The node-add action must accept only tenant/project/workflow identity and a supported node type. It must not accept node config, credentials, action payloads, trigger schedules, runtime state, publish state, billing data, or execution controls.

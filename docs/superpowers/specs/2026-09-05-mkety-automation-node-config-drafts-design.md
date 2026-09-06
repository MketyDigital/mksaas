# Mkety Automation Node Configuration Draft Shell Design

## Goal

Extend the Automation builder with non-executable node configuration drafts while preserving all existing workflow-definition data and all runtime safety boundaries.

## Scope

Supported workflow node types remain `trigger`, `agent`, `http`, `transform`, and `condition`.

Managers may edit only two safe draft metadata fields on an existing supported node:

- `label`
- `notes`

These values are stored inside the node's existing `config` object. Every unrelated config key must be preserved.

## Data-safety rules

- Adding a draft node must append exactly one node without filtering or rebuilding existing nodes.
- Unknown/future node types must survive draft-node append operations unchanged.
- Extra node metadata and definition-level metadata must survive unchanged.
- Generated draft-node IDs must not collide with existing IDs.
- Config-draft updates require exactly one matching stable node ID.
- Unsupported nodes are inspection-only and cannot be configured through this shell.
- Clearing `label` or `notes` removes only that metadata key and does not replace the rest of `config`.

## Authorization

All mutations continue through `requireProjectAccess` and require `access.canManage`.

Workflow reads and writes remain scoped by tenant, project, and workflow.

## UI

The builder page keeps the existing read-only builder summary, workflow metadata editor, and draft-node append form. A new node configuration section renders one metadata form per configurable node.

The form does not expose runtime-specific values such as HTTP URLs, prompts, condition expressions, credentials, provider connections, scheduling, activation, execution, retries, publishing, billing, deployment, or trading controls.

## Explicit non-goals

This phase does not add:

- workflow execution
- webhook activation
- trigger scheduling
- action dispatch
- provider credentials or secrets
- provider/OAuth integrations
- retry execution
- node deletion or reordering
- visual drag-and-drop editing
- publish/status controls
- billing/credits/usage deduction
- deployment automation
- trading runtime

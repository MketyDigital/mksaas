# Mkety Automation Workflow Structure Draft Editing Design

## Goal

Add safe workflow-structure draft editing for supported Automation nodes without enabling execution or activation.

## Scope

Managers may perform four structure-only operations on supported nodes that have stable IDs:

- move one position up
- move one position down
- duplicate
- delete

All operations modify only the workflow `definition` and `updatedAt`.

## Data-safety rules

- Unknown, malformed, and future node types remain inspection-only and cannot be directly edited by this surface.
- Moving a supported node may move it across an unknown node, but the unknown node object must remain byte-for-byte structurally unchanged.
- Duplicate copies the full target node, including existing config and extra metadata, and changes only the duplicate ID.
- Duplicate IDs must be deterministic and collision-safe: `<node-id>-copy`, then `<node-id>-copy-2`, `<node-id>-copy-3`, and so on.
- Delete removes exactly one uniquely matched supported node.
- Ambiguous or missing node IDs are rejected.
- Moving the first node up or last node down is rejected instead of performing a meaningless write.
- Definition-level metadata and all non-target node data must be preserved.

## Authorization

All structure mutations continue through `requireProjectAccess` and require `access.canManage`.

Reads and writes remain scoped by tenant, project, and workflow.

## UI

The Automation builder page adds a manager-only Workflow Structure Drafts section. Each supported stable-ID node gets only the structure controls that are valid for its current position.

No drag-and-drop dependency is introduced in this phase.

## Explicit non-goals

This phase does not add workflow execution, test runs, action dispatch, webhook or scheduler activation, credentials, secrets, OAuth, provider calls, retries, publishing, billing, deployment automation, trading runtime, or visual drag-and-drop editing.

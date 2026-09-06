# Mkety Automation Type-Specific Node Configuration Drafts Design

## Goal

Expand Automation node configuration from generic metadata into safe, type-specific draft fields without enabling workflow execution or external side effects.

## Supported node types and draft fields

- `trigger`: `triggerMode` (`manual`, `webhook`, or `schedule`). This is preparation only and does not activate a webhook or scheduler.
- `agent`: `agentId`, `prompt`.
- `http`: `method`, `url`, `headers`, `body`.
- `transform`: `input`, `mapping`.
- `condition`: `field`, `operator`, `value`.

Every supported node continues to expose generic `label` and `notes` metadata.

## Data safety

All updates remain inside the workflow JSON `definition`. A node update must target exactly one stable node ID, preserve every non-target node, preserve definition-level metadata, preserve extra node metadata, and preserve every unrelated config key.

Only whitelisted fields for the target node type may be changed by this UI. Clearing a whitelisted field removes only that field from `config`.

## Validation

- Labels: maximum 120 characters.
- Notes: maximum 500 characters.
- Agent IDs: maximum 160 characters.
- Prompts: maximum 4,000 characters.
- HTTP methods: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`.
- HTTP URLs: maximum 2,048 characters and, when present, must use `http:` or `https:`.
- HTTP headers: maximum 4,000 characters.
- HTTP body: maximum 10,000 characters.
- Transform input: maximum 2,000 characters.
- Transform mapping: maximum 6,000 characters.
- Condition field: maximum 200 characters.
- Condition operators: `equals`, `not_equals`, `contains`, `greater_than`, `less_than`.
- Condition value: maximum 2,000 characters.

## Authorization

The existing `requireProjectAccess` boundary remains authoritative. Only users with `access.canManage` may save node configuration drafts. Reads and writes stay scoped by tenant, project, and workflow.

## UI

The existing node configuration section becomes the single editor for both generic metadata and type-specific draft fields. The form renders only the fields appropriate for the node type and labels all executable-looking values as drafts.

No run, test-request, activate, schedule-now, webhook-listener, retry, publish, credential, secret, OAuth, billing, deployment, or trading controls are added.

## Explicit non-goals

This phase does not add workflow execution, action dispatch, variable interpolation, webhook activation, scheduler activation, agent invocation, HTTP requests, transform execution, condition evaluation, retries, publishing, credentials, provider integrations, billing/usage deduction, deployment automation, or trading runtime.

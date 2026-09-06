# Mkety Automation Workflow Draft Validation / Preflight Design

## Goal

Add a read-only preflight layer that evaluates Automation workflow draft definitions before runtime execution is introduced.

## Architectural alignment

Mkety Automate remains independent from the AI workspace. AI may appear as an `agent` action inside a workflow, but preflight must not query or execute the AI workspace. Validation is structural and deterministic over the already-loaded workflow definition.

The execution roadmap remains:

`Draft -> Configure -> Arrange -> Preflight Validate -> Execution Foundation`

## Validation model

`validateAutomationWorkflowDefinition(definition)` returns structured checks with severity `error`, `warning`, or `ready`, plus aggregate counts and `readyForExecutionFoundation`.

Readiness requires zero errors and zero warnings. A warning does not mutate or reject the draft, but it prevents the UI from describing the definition as ready for the future execution foundation.

## Global checks

- The workflow contains at least one node.
- Every node has a non-empty stable string ID.
- Stable node IDs are unique.
- At least one trigger node exists.
- More than one trigger is reported as ambiguous.
- Unsupported, malformed, or future node types remain untouched and are reported as inspection-only warnings.

## Type-specific checks

### Trigger

- `triggerMode` must be one of `manual`, `webhook`, or `schedule`.
- Preflight does not activate webhooks or schedules.

### Agent

- `agentId` must be present.
- `prompt` must be present.
- Preflight does not resolve the agent against the AI workspace, call a model, or execute an agent.

### HTTP

- `method` must be one of `GET`, `POST`, `PUT`, `PATCH`, or `DELETE`.
- `url` must be a valid `http` or `https` URL.
- No network request is made.

### Transform

- `input` must be present.
- `mapping` must be present.
- No transformation is evaluated.

### Condition

- `field` must be present.
- `operator` must be one of `equals`, `not_equals`, `contains`, `greater_than`, or `less_than`.
- `value` must be present.
- No condition is evaluated.

## Data flow

`getAutomationBuilderSnapshot()` validates the raw workflow definition after the tenant/project-scoped workflow record is loaded. It passes only the structured preflight result to the builder view model; the UI does not need the raw workflow JSON.

## UI

The builder renders a read-only `Workflow preflight` panel with overall status, error/warning/ready counts, exact check messages, node IDs where relevant, and an explicit statement that validation performs no execution or external calls.

## Non-goals

This phase does not add manual execution, webhook execution, scheduling, HTTP calls, agent execution, transform evaluation, condition evaluation, variable interpolation, retries, credentials, secrets, OAuth, provider adapters, publishing, billing/credits, deployment automation, or trading runtime.

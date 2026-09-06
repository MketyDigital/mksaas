# Mkety Automation Manual Run Lifecycle Foundation — Design

## Goal

Introduce the first guarded Automation execution envelope: manager-triggered manual run records with an auditable lifecycle, without dispatching any workflow action.

## Architectural alignment

Mkety Automate remains independent of the AI workspace. AI, HTTP, transform, condition, webhook, interpolation and retry execution are not activated by this phase. The existing lower-level runtime is intentionally not exposed from the builder yet.

Execution records remain tenant scoped, project scoped, workflow scoped, auditable, bounded and failure-aware.

## Manual run admission

A manual builder run is allowed only when:

- the requester has project management access;
- the workflow is found inside the same tenant/project scope;
- current workflow preflight has no errors or warnings;
- no existing run for the workflow is currently `queued` or `running`.

The action re-runs preflight server-side and does not trust UI state.

## Run lifecycle

A successful safe-noop manual run records:

```text
queued -> running -> completed
```

The existing `workflow_runs` table is used. No schema migration is required.

If an error occurs after a run record is created, the run is marked `failed`, its error message is recorded, and `completedAt` is populated.

## Safe no-op orchestration

The orchestration pass inspects the definition only and returns output containing:

- mode: `safe-noop`
- runtimeDispatch: `false`
- workflow version
- inspected node count
- node IDs and node types considered

It never calls the existing `executeWorkflow()` runtime and never performs external or AI side effects.

## UI

The builder shows a manager-only Manual run foundation panel.

- Ready preflight: `Run manual inspection` is enabled.
- Unready preflight: the action is disabled and tells the user to resolve preflight first.
- Non-managers see the protected boundary.
- Existing run history remains read-only and retries remain unavailable.

## Explicit non-goals

This phase does not add HTTP execution, agent execution, transform execution, condition execution, variable interpolation, webhook execution, scheduling, retries, credentials, OAuth, provider integrations, billing/credit deduction, publishing, deployment automation or trading runtime.

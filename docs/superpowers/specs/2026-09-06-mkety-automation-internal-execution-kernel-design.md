# Mkety Automation Internal Execution Kernel Design

## Status
Approved design for the next Automation execution milestone.

## Blueprint alignment
This design implements the next step of the Mkety Automation blueprint in `AGENTS.md` without creating a parallel runtime. Automate remains independent from AI. The long-term pipeline remains Trigger -> Workflow -> Actions -> Conditions/Transformations -> Result, with manual execution, webhook execution, execution history, HTTP, transform, condition, agent actions, interpolation, failure recording, and bounded retries.

All executions remain tenant scoped, project scoped, auditable, observable, bounded, and failure-aware.

## Goal
Evolve the verified manual run-lifecycle foundation from inspection-only execution into deterministic execution of internal-only workflow nodes while preserving a clean path to later HTTP and Agent action adapters.

## Scope
The internal execution kernel supports only `trigger`, `transform`, and `condition`. It rejects `http`, `agent`, and unsupported node types before any workflow data is changed. It must not call the existing full runtime, `fetch`, an AI provider, or any external service.

## Execution contract
Introduce a pure execution function that consumes a validated workflow definition and initial input and returns final data plus structured per-node execution records. Execution records live inside the existing `workflowRuns.output` JSON in this phase.

## Data flow
Manual builder runs begin with `{}` input. Trigger is a no-op. Transform uses the existing `input` and `mapping` draft fields; `mapping` must be a JSON object and string values support interpolation against current workflow data. Condition uses `field`, `operator`, and `value`; supported operators are `equals`, `not_equals`, `contains`, `greater_than`, and `less_than`. A false condition causes later non-trigger nodes to be recorded as skipped.

No arbitrary JavaScript, `eval`, dynamic imports, or executable expressions are permitted.

## External-action boundary
Before execution starts, scan the complete definition. Any `http`, `agent`, or unsupported node rejects execution with `External or unsupported workflow action runtime is not enabled.` This remains intentionally separate from `src/features/automation/lib/workflow-runtime.ts`, which already contains real HTTP and AI dispatch and must not be exposed through the builder yet.

## Run lifecycle integration
The existing manager-only manual action remains the entry point: authorization -> preflight -> concurrency guard -> queued -> running -> internal kernel -> completed/failed. The same `workflowRuns` record remains the audit envelope used by future manual and webhook execution.

## Future compatibility
HTTP and Agent executors will later extend the same orchestration boundary. Manual and future webhook triggers must converge on the same pipeline. Do not build provider adapters, OAuth, secrets, retry scheduling, billing, or webhook endpoints in this phase.

## Testing
Cover trigger no-op, transform/interpolation, nested mapping interpolation, condition true/false behavior, ordered processing, skipped nodes, blocked external/unsupported nodes, malformed mapping, input non-mutation, manual-run integration, manager-only UI, and full CI/smoke verification.
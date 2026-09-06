# Mkety Automation Agent Action Runtime Adapter — Design

## Status

Approved architectural direction for the next Mkety Automation execution milestone.

## Purpose

Add Agent nodes as a real Automation action while preserving the Mkety product boundary that Automation is an independent orchestration workspace and AI is one callable capability within it.

This phase extends the existing workflow execution kernel rather than creating a second Automation runtime.

## Blueprint Alignment

Mkety Automation is intended to support triggers, workflows, actions, conditions/transformations, execution history, HTTP actions, Agent actions, variable interpolation, failure recording, webhook execution, and bounded retries.

This phase advances that roadmap from the already-verified internal execution and guarded HTTP action foundation to an Agent action adapter.

The architectural rules remain:

- tenant scoped;
- project scoped;
- auditable;
- observable;
- bounded;
- failure-aware;
- provider-abstracted;
- Automation remains independent from AI;
- Agent is one action type, not the workflow engine itself.

## Current Foundations Reused

The repository already provides:

1. An Automation execution kernel that supports trigger, transform, condition, and guarded HTTP actions.
2. `workflowRuns` as the lifecycle and audit envelope.
3. Agent records that are editable independently of Automation.
4. Immutable `agentVersions` with a publish lifecycle.
5. AI provider/model abstraction through the existing AI runtime.
6. Non-streaming Agent execution through the existing AI runtime path.

The new Automation Agent adapter should compose these foundations rather than duplicate them.

## Core Design Decision: Published Version Resolution

An Automation Agent node continues to reference an `agentId`.

At runtime, Mkety resolves the currently published version of that Agent inside the same tenant and project.

The mutable `agents` row is not used as the authoritative execution definition.

### Why

Executing a mutable draft Agent would allow an Agent edit to silently change workflow behavior without a publish boundary.

Published-version resolution gives Automation a stable dependency at the moment execution starts and allows the workflow run to record the exact Agent version that was used.

### Runtime resolution scope

Resolution must require all of:

- tenant ID;
- project ID;
- agent ID;
- Agent version status = `published`.

A same-ID Agent outside the current tenant/project must never be resolvable.

If no published same-scope version exists, runtime readiness fails before the workflow run is admitted.

## Why Not Pin `agentVersionId` in Every Node Yet

Explicit version pinning is more deterministic but would require workflow authors to repin each node after every Agent publish.

For the current Mkety product stage, resolving the latest published version at run admission gives a clean user experience while still making each individual run auditable because the resolved version is recorded with the execution result.

Optional explicit version pinning can be introduced later without changing the Agent adapter contract.

## Execution Architecture

The existing Automation kernel remains the single orchestration pipeline.

Conceptually:

```text
Manual trigger now / Webhook trigger later
                ↓
        Workflow run admission
                ↓
        Runtime readiness
                ↓
       Dependency resolution
                ↓
      Unified execution kernel
       ├─ Trigger executor
       ├─ Transform executor
       ├─ Condition executor
       ├─ HTTP adapter
       └─ Agent adapter
                ↓
        workflowRuns audit
```

The Agent adapter does not own workflow sequencing, condition behavior, run state transitions, or retries.

Those concerns remain orchestration responsibilities of the Automation layer.

## Agent Adapter Contract

Introduce an Automation-facing Agent execution adapter with a narrow interface.

Representative contract:

```ts
export type AutomationAgentExecutionInput = {
  tenantId: string;
  projectId: string;
  agentId: string;
  prompt: string;
};

export type AutomationAgentExecutionResult = {
  agentId: string;
  versionId: string;
  version: number;
  provider: string;
  model: string | null;
  durationMs: number;
  text: string;
  outputPreview: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
};
```

Exact types may be adjusted during implementation to match the installed AI SDK and schema types, but the boundary remains narrow and sanitized.

## Prompt Semantics

The existing Agent node `prompt` field becomes the workflow input to the Agent adapter.

Prompt text uses the same workflow interpolation model already used by transforms and HTTP actions.

Example:

```text
Summarize the following customer response: {{http.body}}
```

Interpolation occurs immediately before Agent execution using current workflow data.

An empty resolved prompt is a runtime blocker/error and must not trigger an AI request.

## Workflow Data Output

After successful Agent execution, the kernel merges a sanitized result into the current workflow data under the Agent namespace.

Representative shape:

```ts
{
  agent: {
    nodeId: 'agent-1',
    agentId: '...',
    versionId: '...',
    version: 3,
    text: '...'
  }
}
```

This enables later transform, condition, HTTP, or Agent nodes to consume `{{agent.text}}` and related stable metadata.

A later phase may evolve this into per-node namespaces if multiple Agent nodes require simultaneous addressability. The execution-step audit already retains node-specific history, so this phase does not need to invent a graph data model prematurely.

## Execution-Step Audit Metadata

The Agent execution step records bounded, non-secret metadata:

- node ID;
- status;
- Agent ID;
- resolved Agent version ID;
- resolved Agent version number;
- provider identifier;
- model identifier when present;
- duration;
- bounded output preview;
- token usage when the underlying runtime safely exposes it.

The step must not persist:

- provider API keys;
- connection secrets;
- raw provider request objects;
- hidden provider diagnostics;
- unrestricted tool payloads;
- full internal model response objects.

The full generated text may remain in workflow data because downstream workflow nodes need it, subject to the existing workflow-run persistence boundary. The human-facing execution metadata should use a bounded preview.

## Runtime Readiness Split

The existing pure runtime capability validator should remain pure.

This phase introduces a second readiness layer for scoped dependencies.

### Layer 1: Pure runtime capability readiness

Checks definition-level facts without database access:

- supported node types;
- required Agent `agentId`;
- required Agent prompt;
- supported HTTP method/URL/body rules;
- malformed node configuration.

After this phase, `agent` is no longer categorically blocked by the pure runtime validator.

### Layer 2: Scoped dependency readiness

Server-side dependency resolution validates:

- the referenced Agent exists in the current tenant/project;
- it has a published version;
- the published version can be represented as an Automation-safe Agent runtime definition;
- its automated execution policy is allowed for this phase.

The result should identify blockers by node ID and should be computed before a manual run record is inserted.

This keeps database concerns out of the pure validator and creates a reusable dependency-resolution boundary for future webhook execution.

## Tool-Disabled Agent Execution

This is a critical safety rule for the first Agent Automation phase.

Published Agents may already have configured tools. Those tools can themselves perform actions and therefore create an uncontrolled second side-effect channel outside the guarded HTTP adapter.

Automation Agent execution in this phase must therefore run with tools disabled, even when the published Agent version contains tool configuration.

### Intended behavior

The adapter may reuse the existing provider/model/knowledge preparation path, but it must execute with an empty tool set and a bounded single-generation policy suitable for Automation.

The Agent can:

- use its published instructions;
- use the configured provider/model abstraction;
- use scoped knowledge retrieval if supported by the existing runtime and safe for the tenant/project;
- generate text.

The Agent cannot:

- invoke Agent tools;
- make hidden external side effects through tool calls;
- trigger deployments;
- invoke Trading actions;
- send messages;
- mutate third-party systems.

Tool-capable Agent automation is deferred until Mkety has explicit workflow tool policy, permissions, credential scoping, audit semantics, and bounded side-effect controls.

## AI Runtime Reuse

Do not duplicate provider selection, model construction, or knowledge retrieval inside Automation.

Prefer exposing or extracting a small non-streaming AI execution function that accepts an immutable Agent runtime definition plus messages and an Automation-safe execution policy.

The Automation adapter owns:

- tenant/project/version resolution;
- prompt interpolation handoff;
- tool-disabled policy;
- result sanitization;
- execution metadata.

The AI subsystem owns:

- provider abstraction;
- model construction;
- system prompt construction;
- knowledge retrieval;
- model invocation.

This separation preserves the platform architecture.

## Failure Behavior

Failures are deterministic from the Automation lifecycle perspective.

Examples:

- Agent reference missing;
- no published version;
- cross-scope reference;
- empty resolved prompt;
- provider/model configuration unavailable;
- AI provider request failure;
- model output failure;
- knowledge preparation failure.

When execution has already entered the run lifecycle, the existing manual run action records the workflow run as `failed` with a sanitized error and `completedAt`.

Dependency-readiness failures discovered before admission do not create a run record.

No retries are introduced in this phase.

## Condition and Ordering Semantics

Agent nodes participate in the same ordered execution behavior as existing nodes.

A false Condition skips later non-trigger Agent nodes exactly as it skips transform and HTTP nodes.

An Agent node may consume current workflow data produced by earlier transform/HTTP/Agent nodes.

Its output becomes available to later nodes.

This phase does not introduce branching graph edges or parallel execution.

## Manual Run Integration

The manual run admission sequence becomes:

```text
authorize
→ static preflight
→ pure runtime capability readiness
→ scoped dependency readiness
→ overlapping queued/running guard
→ create queued run
→ mark running
→ unified workflow executor
→ completed or failed
→ redirect
```

Future webhook execution should reuse the same readiness, dependency resolution, executor, and run-output contracts.

## Builder UI

The workflow builder should distinguish:

- static/preflight readiness;
- runtime capability readiness;
- dependency readiness.

A manager can start a manual workflow only when all required readiness layers are clean.

Agent-related blockers should explain concrete causes such as:

- Agent reference missing;
- Agent not found in this project;
- no published Agent version;
- Agent automation policy unavailable.

The UI should state that Agent actions execute published text/knowledge behavior only and that Agent tools, retries, webhooks, credentials, and schedules remain disabled.

## Security Boundaries

Mandatory:

- tenant/project scoped Agent lookup;
- published version only;
- no mutable draft execution;
- tool-disabled execution;
- no API keys or secrets persisted into workflow output;
- no raw provider response persistence;
- bounded output preview;
- no arbitrary JavaScript or `eval`;
- no implicit network side effects except the model provider call required for Agent generation;
- no direct use of Agent UI/server actions from Automation.

## Billing and Usage

This phase may record token usage metadata when naturally available from the existing AI runtime, but it does not introduce billing deductions, wallet mutations, credit enforcement, or subscription metering.

Those belong to a later platform-wide usage/billing integration layer.

## Schema Changes

No schema migration is required for the first implementation unless inspection during implementation reveals that the current run output type cannot safely store the required audit metadata.

The existing Agent version schema is already the immutable dependency source.

## Explicit Non-Goals

This phase does not add:

- Agent tool execution;
- Agent-created HTTP calls through tools;
- webhook activation;
- schedule activation;
- retries;
- OAuth;
- credential vaulting;
- provider connector catalog;
- workflow publishing;
- graph branching;
- parallel execution;
- billing/credit deduction;
- Deploy actions;
- Trading actions;
- arbitrary code execution.

## Testing Strategy

Use TDD with a real red→green CI cycle.

Required coverage:

### Dependency readiness

- same-tenant/project published Agent resolves;
- draft-only Agent blocks;
- disabled/no-published Agent blocks;
- cross-tenant Agent blocks;
- cross-project Agent blocks;
- missing Agent blocks;
- multiple Agent nodes resolve independently;
- no mutation of workflow definition.

### Agent adapter

- resolves published immutable version;
- sends interpolated prompt as a user message;
- executes non-streaming generation;
- forces tools disabled;
- preserves provider/model abstraction;
- includes knowledge path only through the AI subsystem;
- returns text and bounded metadata;
- sanitizes errors;
- never exposes secrets/raw provider response.

### Unified kernel

- transform → Agent executes in order;
- HTTP → Agent consumes current data;
- Agent → transform consumes `agent.text`;
- false condition skips Agent and adapter is not called;
- unsupported node blocks before any HTTP or Agent side effect;
- workflow input remains immutable.

### Manual run lifecycle

- dependency blockers fail before run creation;
- valid Agent workflow enters queued → running → completed;
- Agent failure records failed run;
- scoped run updates remain tenant/project/workflow constrained.

### UI

- ready Agent workflow enables run;
- dependency blocker disables run;
- blocker reason renders;
- copy explains published-version/text-only Agent execution;
- tools/webhooks/retries/credentials remain clearly unavailable;
- non-manager remains protected.

### Full verification

Require fresh GitHub Actions evidence for:

- full tests;
- lint;
- type-check;
- build;
- Mkety Platform Core Workspaces Smoke.

## Evolution Path After This Phase

```text
Persistence
→ Builder
→ Configuration
→ Structure
→ Preflight
→ Run Lifecycle
→ Internal Execution Kernel
→ Guarded HTTP Action
→ Published-Version Agent Action
→ Webhook Trigger
→ Richer Variable/Per-Node Outputs
→ Bounded Retry Policy
→ Managed Credentials / Connectors
→ Explicit Tool-Capable Agent Policy
→ Richer Branching / Execution Plans
```

The Agent adapter is therefore a permanent component of the end-state Mkety Automation architecture, not a temporary shortcut.
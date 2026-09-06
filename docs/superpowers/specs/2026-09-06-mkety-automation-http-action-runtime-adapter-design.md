# Mkety Automation HTTP Action Runtime Adapter — Design

## Status

Approved architectural direction for the next Mkety Automation execution milestone.

## Authority and product alignment

This design implements the next step of the Automation foundation defined by `AGENTS.md`:

- Automation remains an independent Mkety Platform workspace.
- Workflow execution stays tenant scoped, project scoped, auditable, observable, bounded, and failure-aware.
- Manual execution and future webhook execution converge on one execution pipeline.
- HTTP is the first external action adapter added to the internal execution kernel.
- Agent execution remains a later adapter and must not be coupled into this phase.
- Generic HTTP comes before provider-specific connectors, OAuth adapters, or integration catalogs.

The intended long-term progression remains:

`workflow persistence → builder → configuration → structure → preflight → run lifecycle → internal execution kernel → HTTP action adapter → Agent action adapter → webhook trigger → richer interpolation → bounded retries → provider adapters/connectors`

This phase must move the current system forward without creating a second workflow runtime that later has to be replaced.

## Goal

Enable the current manual workflow execution pipeline to execute one real HTTP action safely, while preserving the existing internal trigger/transform/condition execution behavior and the existing `workflowRuns` audit lifecycle.

## Non-goals

This phase does not add:

- Agent execution.
- Webhook activation or inbound webhook endpoints.
- Schedules.
- OAuth or provider-specific connectors.
- Credential storage or secret injection.
- Arbitrary custom request headers.
- Retry orchestration.
- Billing, credit deduction, or usage charging.
- Deployment automation.
- Trading execution.
- Arbitrary JavaScript, `eval`, or user-supplied executable code.
- A new workflow persistence model.
- A second run-history model.

## Current system boundary

The current `internal-execution-kernel.ts` executes only `trigger`, `transform`, and `condition` nodes. It refuses every external or unsupported node before execution begins. This behavior protects the manual execution path from the older full runtime in `src/features/automation/lib/workflow-runtime.ts`, which already contains HTTP and Agent side effects.

The HTTP adapter must extend the new project-workspace execution path, not expose or call the older monolithic runtime.

## Architecture

### One execution pipeline

The existing manual run server action remains the orchestration envelope:

1. Resolve tenant/project/workflow through the existing authorization boundary.
2. Re-run workflow preflight server-side.
3. Reject an overlapping queued/running execution.
4. Insert the tenant/project/workflow-scoped `workflowRuns` row as `queued`.
5. Mark it `running`.
6. Execute the workflow through the Automation execution kernel.
7. Persist structured output and mark `completed`, or persist the error and mark `failed`.

The new HTTP action must execute inside step 6. Future webhook triggers will enter the same envelope and kernel rather than receiving a separate runtime implementation.

### Kernel evolution

The internal executor becomes an asynchronous workflow executor because HTTP actions are asynchronous.

Recommended public contract:

```ts
export type AutomationExecutionContext = {
  tenantId: string;
  projectId: string;
  workflowId: string;
  triggerType: 'manual';
};

export type AutomationExecutionStep = {
  nodeId: string;
  nodeType: 'trigger' | 'transform' | 'condition' | 'http';
  status: 'completed' | 'skipped';
  conditionMatched?: boolean;
  resolvedInput?: string;
  http?: {
    method: string;
    status: number;
    durationMs: number;
    responseType: 'json' | 'text' | 'empty';
    responsePreview: unknown;
  };
};

export type AutomationExecutionResult = {
  mode: 'workflow-execution';
  data: Record<string, unknown>;
  steps: AutomationExecutionStep[];
};

export async function executeAutomationWorkflowDefinition({
  context,
  definition,
  input,
}: {
  context: AutomationExecutionContext;
  definition: unknown;
  input: Record<string, unknown>;
}): Promise<AutomationExecutionResult>;
```

The context is deliberately introduced now even though the HTTP adapter does not need database access. Future Agent actions, internal Mkety actions, usage accounting, and execution-policy checks will need tenant/project/workflow scope. Establishing that execution contract now avoids later runtime fragmentation.

The executor must remain deterministic for trigger/transform/condition nodes and preserve the current condition skip behavior.

## HTTP executor boundary

Create a dedicated module for HTTP behavior rather than embedding network concerns directly inside the workflow loop.

Recommended contract:

```ts
export type AutomationHttpExecutionInput = {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;
  body?: string;
};

export type AutomationHttpExecutionResult = {
  method: AutomationHttpExecutionInput['method'];
  status: number;
  durationMs: number;
  responseType: 'json' | 'text' | 'empty';
  responsePreview: unknown;
  data: unknown;
};

export async function executeAutomationHttpAction(
  input: AutomationHttpExecutionInput,
): Promise<AutomationHttpExecutionResult>;
```

The workflow kernel owns interpolation and workflow data flow. The HTTP executor owns outbound transport safety, timeout, response limits, and response normalization.

This separation allows later provider adapters to either reuse the guarded HTTP transport or implement their own constrained action executors without changing the workflow orchestration contract.

## HTTP node configuration

This phase reuses the existing HTTP draft fields:

- `method`
- `url`
- `body`

The existing generic `headers` draft field is not runtime-enabled in this phase.

### URL

The URL is interpolated from current workflow data before dispatch.

Example:

```text
https://api.example.com/customers/{{customerId}}
```

Only `https:` URLs may execute.

A structurally valid `http:` draft can remain editable, but runtime readiness must report it as not executable until converted to HTTPS. This creates an explicit distinction between draft structural validity and runtime readiness.

### Method

Allowed runtime methods:

- `GET`
- `POST`
- `PUT`
- `PATCH`
- `DELETE`

No arbitrary verbs are accepted.

### Body

The existing body draft is treated as a text template.

- For `POST`, `PUT`, and `PATCH`, interpolate `{{variable}}` expressions into the body string.
- If the resolved body is valid JSON, send it as JSON with the built-in `content-type: application/json` header.
- If the resolved body is non-empty but invalid JSON, fail before network dispatch with a clear configuration/runtime error. The first external runtime slice will not silently send arbitrary malformed payload text.
- `GET` and `DELETE` do not send a body in this phase.

No user-configured headers are sent.

## Egress and SSRF safety

HTTP actions execute from Mkety infrastructure, so server-side request forgery protection is a first-class requirement.

The adapter must not use unrestricted `fetch(url)` with automatic DNS resolution and redirect following.

### Transport choice

Use Node's HTTPS transport with a guarded DNS lookup path so the address validated by policy is the address used by the socket connection.

The transport must:

- require `https:`;
- resolve the hostname through a custom lookup function;
- reject loopback, private, link-local, unspecified, multicast, and other non-public IPv4/IPv6 destinations;
- reject `localhost` and local-style hostnames;
- reject literal private/internal IP addresses before connection;
- set `rejectUnauthorized: true` for TLS;
- not automatically follow redirects;
- fail all `3xx` responses as redirects unsupported in this phase;
- use the URL hostname for TLS SNI/hostname validation;
- never send platform credentials or inherited cookies.

This ensures a workflow cannot use the Mkety HTTP action as an internal-network or metadata-service probe.

### Timeout

Hard request timeout: **10 seconds**.

Timeout failure must abort/destroy the request and propagate a bounded, non-secret error message into the workflow run failure record.

No retry occurs in this phase.

### Response-size cap

Maximum response body retained/read by this action: **256 KiB**.

If the response exceeds the cap, abort the request and fail the action. Do not continue buffering unbounded response data.

### Redirects

No redirects are followed.

Any `3xx` response fails with a bounded message. Redirect handling can be reconsidered later only if each destination is revalidated by the same egress policy.

## Header policy

The current generic draft headers field is deliberately not executable.

The first adapter sends only transport-controlled headers:

- `accept: application/json, text/plain;q=0.9`
- `content-type: application/json` only when a body is present
- an appropriate bounded `content-length` generated from the final body

Do not forward or accept user-supplied:

- `Authorization`
- `Cookie`
- `Proxy-Authorization`
- `X-API-Key`
- token/key/secret-style headers
- host override headers
- connection-control headers

Credential-aware request headers belong to the future Mkety integration/credential layer, where secrets can be stored and injected safely rather than persisted in plain workflow definition JSON.

## Response handling and workflow data

For successful `2xx` responses:

- empty body → `responseType: 'empty'`, data `null`;
- valid JSON → `responseType: 'json'`, parsed JSON data;
- otherwise → `responseType: 'text'`, bounded UTF-8 text.

The kernel stores the latest HTTP action result in workflow data under a stable namespace:

```ts
{
  ...currentData,
  http: {
    nodeId,
    status,
    body: result.data,
  },
}
```

The node execution step records only bounded observable metadata:

- node ID
- method
- status code
- duration
- response type
- response preview

The preview must be bounded independently from the full 256 KiB transport cap so execution history remains compact. Maximum persisted preview target: **4 KiB equivalent**.

The run output must not persist request headers, secrets, cookies, authorization data, or full internal transport diagnostics.

## Status handling

Runtime success is restricted to HTTP `2xx` status codes.

- `2xx` → action completed.
- `3xx` → fail because redirects are disabled.
- `4xx`/`5xx` → fail with status plus a bounded sanitized response preview.
- network/DNS/TLS/timeout/response-cap failure → fail with a normalized bounded error.

Failures propagate through the existing manual-run `try/catch`, which marks the `workflowRuns` record `failed`, stores the sanitized error string, and sets `completedAt`.

## Condition interaction

Condition behavior remains unchanged.

When a condition evaluates false:

- subsequent non-trigger nodes, including HTTP actions, are marked `skipped`;
- skipped HTTP nodes must never open a network connection;
- a later trigger node preserves the current kernel semantics defined for trigger boundaries.

The executor must scan/validate node runtime support before any side effect occurs so a later unsupported Agent/future node cannot cause a workflow to partially execute external actions before ultimately failing.

## Runtime-support precheck

Before executing the first node, inspect the full node list.

Allowed executable node types in this phase:

- `trigger`
- `transform`
- `condition`
- `http`

Still runtime-disabled:

- `agent`
- unknown/future node types

If any runtime-disabled node exists, fail before executing any transform, condition, or HTTP side effect.

This is stricter than merely failing at the unsupported node and prevents partial external execution.

## Preflight and runtime readiness

Static draft validation and runtime readiness must remain separate concepts.

`validateAutomationWorkflowDefinition()` continues checking draft structure.

Add a pure runtime-readiness assessment, for example:

```ts
export type AutomationWorkflowRuntimeReadiness = {
  ready: boolean;
  blockers: Array<{
    code: string;
    message: string;
    nodeId?: string;
  }>;
};

export function validateAutomationWorkflowRuntimeReadiness(
  definition: unknown,
): AutomationWorkflowRuntimeReadiness;
```

Runtime readiness in this phase must block:

- Agent nodes.
- Unknown/future nodes.
- HTTP URLs that are not HTTPS.
- HTTP nodes with unsupported methods.
- HTTP nodes whose executable body configuration is invalid where validation can be done statically.

The manual run action requires both:

1. clean static preflight; and
2. clean runtime readiness.

The UI should explain the difference rather than changing workflow status or publishing anything.

## Observability

The existing `workflowRuns` table remains the authoritative run record.

No new top-level execution-history table is required in this phase.

Run output should include enough structured step data to inspect what executed without leaking transport secrets.

Future per-node event tables or richer telemetry can be introduced when actual product requirements justify them.

## Concurrency

Preserve the current workflow-level overlapping-run guard for queued/running records.

This guard is still application-level rather than a database-enforced lock. It is sufficient for the current controlled manual-run phase, but webhook/high-concurrency execution will require a stronger concurrency strategy before production-scale activation.

Do not silently present the existing check as a perfect distributed lock.

## Error messages

User-visible/persisted HTTP errors must be bounded and normalized.

Examples:

- `HTTP action requires an HTTPS URL.`
- `HTTP action destination is not publicly routable.`
- `HTTP action timed out after 10000ms.`
- `HTTP action response exceeded 262144 bytes.`
- `HTTP action redirects are not enabled.`
- `HTTP action failed with status 404: <bounded preview>`

Do not persist raw socket objects, request options, stack traces, DNS internals, or configuration containing future credentials.

## Files and responsibilities

Expected additions/changes:

- `src/features/projects/workspaces/automation/http-action-runtime.ts`
  - guarded HTTPS transport, DNS/address policy, timeout, body/response limits, normalized result/errors.
- `src/features/projects/workspaces/automation/http-action-runtime.test.ts`
  - pure/unit-level transport policy tests with network primitives mocked; no real internet dependency in CI.
- `src/features/projects/workspaces/automation/internal-execution-kernel.ts`
  - evolve into async workflow executor; dispatch HTTP nodes through the dedicated adapter; preserve internal-node behavior and pre-execution support scan.
- `src/features/projects/workspaces/automation/internal-execution-kernel.test.ts`
  - HTTP dispatch integration tests with adapter mocked, skip behavior, no-partial-execution behavior, interpolation/body/data propagation.
- `src/features/projects/workspaces/automation/workflow-runtime-readiness.ts`
  - pure runtime-readiness validation distinct from draft preflight.
- `src/features/projects/workspaces/automation/workflow-runtime-readiness.test.ts`
  - Agent/unknown blocking, HTTPS requirements, supported methods/body readiness.
- `src/features/projects/workspaces/automation/actions.ts`
  - require runtime readiness and await the unified executor inside the existing run lifecycle.
- `src/features/projects/workspaces/automation/AutomationWorkflowManualRunForm.tsx`
  - update copy from internal-only execution to current HTTP-capable runtime, and disable run when runtime readiness is blocked.
- related component tests and focused Automation smoke workflow.

No database migration is required.

## Testing strategy

### HTTP adapter tests

Test without real external network calls by mocking/injecting the HTTPS/DNS boundary.

Required cases:

- accepts public HTTPS destination;
- rejects `http:`;
- rejects localhost;
- rejects private IPv4 ranges;
- rejects loopback/link-local IPv4;
- rejects private/link-local/loopback IPv6;
- rejects redirect status;
- rejects non-2xx response with bounded preview;
- parses JSON response;
- returns bounded text response;
- handles empty response;
- rejects response over 256 KiB;
- times out at the configured bound;
- does not send user-defined headers;
- sends JSON content type only for valid body methods.

### Kernel tests

Required cases:

- trigger → transform → HTTP executes in order;
- URL interpolation uses current workflow data;
- body interpolation uses current workflow data;
- HTTP response becomes `data.http` for later nodes;
- a false condition skips HTTP without calling adapter;
- Agent node anywhere in definition blocks the entire run before HTTP executes;
- unknown node anywhere blocks before HTTP executes;
- input is not mutated;
- existing transform/condition tests remain green.

### Runtime-readiness tests

Required cases:

- internal-only workflow ready;
- valid HTTPS HTTP workflow ready;
- `http:` URL blocked for runtime even though static draft validation currently accepts HTTP(S);
- Agent node blocked for runtime;
- unsupported/unknown node blocked;
- unsupported method blocked;
- invalid body configuration blocked where statically detectable.

### Server/UI tests

Required cases:

- manager manual run requires static preflight and runtime readiness;
- runtime-blocked workflow cannot submit from builder UI;
- non-manager remains unable to run;
- UI explicitly states HTTP execution is enabled but Agent/webhook/retries/credentials remain unavailable;
- no Retry/Activate/Publish control is introduced.

### Verification

After implementation, run the real GitHub Actions validation used by this branch:

- full tests;
- lint;
- type-check;
- build;
- Mkety Platform Core Workspaces Smoke.

Use a red → green TDD cycle for the new HTTP adapter/runtime tests. Do not claim success until the exact implementation commit has fresh green evidence.

## Security and product boundary review

Before considering this phase complete, verify all of the following:

- HTTP execution can only reach public HTTPS destinations under the guarded resolver policy.
- Redirects are not followed.
- Response buffering is bounded.
- Request duration is bounded.
- No retries occur.
- No user-supplied headers are sent.
- No secrets are persisted or injected.
- Agent execution remains blocked.
- Unsupported nodes block before any HTTP side effect.
- Run records remain tenant/project/workflow scoped.
- Existing `workflowRuns` remains the audit envelope.
- The older monolithic runtime is still not called from the builder path.

## Future compatibility

This design intentionally leaves clean extension points for:

1. **Agent action adapter** — consumes `AutomationExecutionContext`, resolves Agent resources inside tenant/project scope, and returns structured action results.
2. **Webhook trigger** — creates the same run lifecycle and invokes the same workflow executor with `triggerType: 'webhook'`.
3. **Bounded retries** — wraps selected action executors with explicit retry policy, maximum attempts, backoff, and retry-safe error classification.
4. **Credentials/integrations** — injects managed secrets at execution time without persisting them inside workflow definitions.
5. **Provider adapters** — build on generic guarded HTTP where appropriate instead of multiplying unrelated runtimes.
6. **Usage/billing** — attaches metering around the same run/action boundaries without changing workflow semantics.

The HTTP adapter is therefore a production-direction execution component, not a throwaway bridge.
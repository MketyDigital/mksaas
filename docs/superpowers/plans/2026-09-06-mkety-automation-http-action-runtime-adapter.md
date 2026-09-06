# Mkety Automation HTTP Action Runtime Adapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the first safe external Automation action by allowing the existing manual workflow execution pipeline to execute guarded HTTP nodes without exposing Agent execution, webhooks, credentials, retries, or a second runtime.

**Architecture:** Evolve the current internal execution kernel into a single async workflow executor and add a dedicated guarded HTTP transport module. Keep static draft preflight separate from runtime readiness, reuse the existing `workflowRuns` lifecycle, preserve trigger/transform/condition behavior, and block Agent/unknown nodes before any side effect occurs.

**Tech Stack:** Next.js 16, TypeScript, Node.js HTTPS/DNS primitives, Drizzle ORM, Jest, Testing Library, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-06-mkety-automation-http-action-runtime-adapter-design.md`

## Global Constraints

- `AGENTS.md` remains the architectural source of truth.
- Automation remains independent from AI; Agent is only a future action adapter.
- Manual and future webhook triggers must converge on one execution pipeline.
- Executions remain tenant scoped, project scoped, auditable, observable, bounded, and failure-aware.
- HTTP runtime supports only `GET`, `POST`, `PUT`, `PATCH`, `DELETE`.
- Runtime HTTP requires `https:`.
- Hard request timeout is 10,000 ms.
- Maximum response body is 262,144 bytes.
- Maximum persisted response preview target is 4 KiB equivalent.
- Redirects are not followed.
- Localhost, loopback, private, link-local, multicast, unspecified, and other non-public destinations are rejected.
- Custom request headers and credentials are not runtime-enabled in this phase.
- Agent execution, webhook activation, schedules, retries, OAuth/connectors, billing, deployment automation, Trading execution, arbitrary JavaScript, and `eval` remain out of scope.
- No database migration is required.
- Do not route the new builder/manual-run path through `src/features/automation/lib/workflow-runtime.ts`.

---

### Task 1: Runtime Readiness Gate

**Files:**
- Create: `src/features/projects/workspaces/automation/workflow-runtime-readiness.ts`
- Create: `src/features/projects/workspaces/automation/workflow-runtime-readiness.test.ts`

**Interfaces:**
- Consumes: current workflow definition shape and existing node config conventions.
- Produces:
  - `AutomationWorkflowRuntimeReadiness`
  - `validateAutomationWorkflowRuntimeReadiness(definition: unknown): AutomationWorkflowRuntimeReadiness`

- [ ] **Step 1: Write failing runtime-readiness tests**

Cover these exact cases:

```ts
expect(validateAutomationWorkflowRuntimeReadiness(internalOnly)).toEqual({ ready: true, blockers: [] });
expect(validateAutomationWorkflowRuntimeReadiness(validHttpsHttp).ready).toBe(true);
expect(validateAutomationWorkflowRuntimeReadiness(httpUrl).blockers).toEqual(
  expect.arrayContaining([expect.objectContaining({ code: 'http.runtime-https-required' })]),
);
expect(validateAutomationWorkflowRuntimeReadiness(agentWorkflow).blockers).toEqual(
  expect.arrayContaining([expect.objectContaining({ code: 'agent.runtime-disabled' })]),
);
expect(validateAutomationWorkflowRuntimeReadiness(unknownWorkflow).blockers).toEqual(
  expect.arrayContaining([expect.objectContaining({ code: 'node.runtime-unsupported' })]),
);
expect(validateAutomationWorkflowRuntimeReadiness(badMethod).ready).toBe(false);
expect(validateAutomationWorkflowRuntimeReadiness(invalidBody).ready).toBe(false);
```

- [ ] **Step 2: Run the focused test and verify red**

Run:

```bash
pnpm test -- src/features/projects/workspaces/automation/workflow-runtime-readiness.test.ts
```

Expected: FAIL because `workflow-runtime-readiness.ts` does not exist.

- [ ] **Step 3: Implement the pure readiness validator**

Requirements:

```ts
export type AutomationWorkflowRuntimeReadinessBlocker = {
  code: string;
  message: string;
  nodeId?: string;
};

export type AutomationWorkflowRuntimeReadiness = {
  ready: boolean;
  blockers: AutomationWorkflowRuntimeReadinessBlocker[];
};

export function validateAutomationWorkflowRuntimeReadiness(
  definition: unknown,
): AutomationWorkflowRuntimeReadiness;
```

Rules:
- trigger/transform/condition are runtime-supported;
- http is supported only when method is allowed, URL is HTTPS, and body is valid JSON for POST/PUT/PATCH when non-empty;
- GET/DELETE body content is ignored for execution and must not make runtime readiness fail solely because it is non-empty;
- agent is blocked with `agent.runtime-disabled`;
- unknown/future node is blocked with `node.runtime-unsupported`;
- malformed node is blocked;
- validator is pure and does not mutate input.

- [ ] **Step 4: Run the focused test and verify green**

```bash
pnpm test -- src/features/projects/workspaces/automation/workflow-runtime-readiness.test.ts
```

Expected: PASS.

---

### Task 2: Guarded HTTP Action Transport

**Files:**
- Create: `src/features/projects/workspaces/automation/http-action-runtime.ts`
- Create: `src/features/projects/workspaces/automation/http-action-runtime.test.ts`

**Interfaces:**
- Consumes: final interpolated HTTP method, URL, and optional JSON body string.
- Produces:

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

- [ ] **Step 1: Write failing transport-policy tests**

Test with mocked/injected Node HTTPS/DNS primitives, never real internet access. Cover:
- public HTTPS destination accepted;
- `http:` rejected;
- localhost rejected;
- private/loopback/link-local IPv4 rejected;
- private/link-local/loopback/unspecified IPv6 rejected;
- redirect response rejected;
- 4xx/5xx rejected with bounded sanitized preview;
- JSON response parsed;
- text response returned;
- empty response returns `null`;
- response over 262,144 bytes rejected;
- timeout at 10,000 ms destroys/aborts the request;
- only built-in safe headers are sent;
- `content-type: application/json` is sent only when a body is present;
- no user-provided headers are accepted by the public API.

- [ ] **Step 2: Run the transport test and verify red**

```bash
pnpm test -- src/features/projects/workspaces/automation/http-action-runtime.test.ts
```

Expected: FAIL because the HTTP adapter does not exist.

- [ ] **Step 3: Implement public-address policy helpers**

Implement explicit IPv4/IPv6 checks for non-public ranges. At minimum reject:
- IPv4: `0.0.0.0/8`, `10.0.0.0/8`, `100.64.0.0/10`, `127.0.0.0/8`, `169.254.0.0/16`, `172.16.0.0/12`, `192.0.0.0/24`, `192.168.0.0/16`, multicast/reserved ranges;
- IPv6: `::`, `::1`, `fc00::/7`, `fe80::/10`, multicast `ff00::/8`, IPv4-mapped private/non-public addresses;
- hostname `localhost` and `.localhost` names.

The same resolved address approved by policy must be returned through the custom lookup function used by the HTTPS socket connection.

- [ ] **Step 4: Implement bounded HTTPS request execution**

Use Node HTTPS transport with:
- `rejectUnauthorized: true`;
- `servername`/hostname validation preserved;
- custom guarded lookup;
- no redirect following;
- 10,000 ms timeout;
- 262,144-byte response cap;
- safe built-in `accept` header;
- `content-type` and `content-length` only for a valid body;
- normalized result/error messages from the approved spec.

- [ ] **Step 5: Run the transport test and verify green**

```bash
pnpm test -- src/features/projects/workspaces/automation/http-action-runtime.test.ts
```

Expected: PASS.

---

### Task 3: Unified Async Workflow Execution Kernel

**Files:**
- Modify: `src/features/projects/workspaces/automation/internal-execution-kernel.ts`
- Modify: `src/features/projects/workspaces/automation/internal-execution-kernel.test.ts`

**Interfaces:**
- Consumes:
  - `executeAutomationHttpAction()` from Task 2;
  - workflow definition;
  - scoped execution context;
  - initial workflow data.
- Produces:

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

export async function executeAutomationWorkflowDefinition({ context, definition, input }): Promise<AutomationExecutionResult>;
```

- [ ] **Step 1: Extend kernel tests before implementation**

Add cases for:
- trigger → transform → HTTP executes in order;
- URL interpolation uses transformed/current data;
- body interpolation uses current data;
- HTTP response becomes `data.http = { nodeId, status, body }`;
- HTTP step records bounded metadata;
- false condition skips HTTP and the HTTP adapter mock is never called;
- Agent anywhere blocks the entire run before the HTTP adapter can be called;
- unknown node anywhere blocks before any HTTP call;
- input object remains unchanged;
- existing transform/condition semantics remain unchanged.

- [ ] **Step 2: Run kernel tests and verify red**

```bash
pnpm test -- src/features/projects/workspaces/automation/internal-execution-kernel.test.ts
```

Expected: FAIL because the current kernel is synchronous and blocks HTTP nodes.

- [ ] **Step 3: Evolve the executor to async without duplicating runtime logic**

Requirements:
- full-list runtime-support scan happens before processing the first node;
- allowed types: trigger, transform, condition, http;
- blocked types: agent and unknown/future;
- preserve transform interpolation and condition behavior;
- resolve HTTP URL from current data;
- for POST/PUT/PATCH interpolate body, validate resulting JSON, then call adapter;
- GET/DELETE send no body;
- merge HTTP result into current workflow data under `http` namespace;
- record HTTP metadata on the step;
- do not expose custom headers;
- do not call the older `workflow-runtime.ts`.

- [ ] **Step 4: Run kernel tests and verify green**

```bash
pnpm test -- src/features/projects/workspaces/automation/internal-execution-kernel.test.ts
```

Expected: PASS.

---

### Task 4: Manual Run Lifecycle Integration

**Files:**
- Modify: `src/features/projects/workspaces/automation/actions.ts`
- Modify: `src/features/projects/workspaces/automation/manual-run-foundation.ts`
- Modify: `src/features/projects/workspaces/automation/manual-run-foundation.test.ts`

**Interfaces:**
- Consumes:
  - static preflight;
  - runtime readiness;
  - unified async executor;
  - existing `workflowRuns` lifecycle.
- Produces: same manager-gated manual-run server action, now capable of HTTP execution.

- [ ] **Step 1: Add failing readiness/lifecycle tests**

Test pure helpers for:
- clean static preflight + clean runtime readiness accepted;
- runtime blocker rejected before a run begins;
- clear error text: `Workflow runtime readiness must be fully ready before a manual run can start.`

- [ ] **Step 2: Run focused helper tests and verify red**

```bash
pnpm test -- src/features/projects/workspaces/automation/manual-run-foundation.test.ts
```

Expected: FAIL until runtime readiness helper is added.

- [ ] **Step 3: Update the manual-run action**

Exact flow:

```text
authorize
→ static preflight
→ runtime readiness
→ overlapping queued/running guard
→ insert queued run
→ mark running
→ await executeAutomationWorkflowDefinition(...)
→ persist completed output
→ or persist sanitized failed error
→ redirect
```

Pass execution context using the resolved `tenantId`, `projectId`, `workflowId`, and `triggerType: 'manual'`.

Remove the old no-op output path from active execution. Keep or delete the old helper only according to whether tests/other consumers still require it; do not leave dead public API without a consumer.

- [ ] **Step 4: Run helper/kernel tests and verify green**

```bash
pnpm test -- src/features/projects/workspaces/automation/manual-run-foundation.test.ts src/features/projects/workspaces/automation/internal-execution-kernel.test.ts
```

Expected: PASS.

---

### Task 5: Builder Runtime Readiness UI

**Files:**
- Modify: `src/features/projects/workspaces/automation/data.ts`
- Modify: `src/features/projects/workspaces/automation/AutomationWorkflowManualRunForm.tsx`
- Modify: `src/features/projects/workspaces/automation/AutomationWorkflowManualRunForm.test.tsx`
- Modify if required: `src/app/(tenant)/t/[tenant]/projects/[project]/automation/[workflow]/page.tsx`

**Interfaces:**
- Consumes: `validateAutomationWorkflowRuntimeReadiness()` result from server-side workflow data.
- Produces: manager-facing run control that is enabled only when static preflight and runtime readiness are both clean.

- [ ] **Step 1: Write/update failing UI tests**

Required assertions:
- clean preflight + runtime readiness enables `Run workflow`;
- runtime-blocked workflow disables the button;
- runtime blocker explanation is shown;
- copy states that HTTP actions can execute;
- copy states Agent actions, webhooks, retries, and credentials are not yet enabled;
- non-manager sees protected boundary;
- no Retry/Activate/Publish button appears.

- [ ] **Step 2: Run UI test and verify red**

```bash
pnpm test -- src/features/projects/workspaces/automation/AutomationWorkflowManualRunForm.test.tsx
```

Expected: FAIL against the existing internal-only copy/props.

- [ ] **Step 3: Wire runtime readiness through snapshot/page/form**

Add runtime readiness to the existing server-side builder snapshot or equivalent page data path. Do not expose raw workflow definition to the client merely to recompute readiness there.

Update the form props so button readiness is:

```ts
const ready =
  preflight.readyForExecutionFoundation &&
  preflight.errorCount === 0 &&
  preflight.warningCount === 0 &&
  runtimeReadiness.ready;
```

- [ ] **Step 4: Run UI test and verify green**

```bash
pnpm test -- src/features/projects/workspaces/automation/AutomationWorkflowManualRunForm.test.tsx
```

Expected: PASS.

---

### Task 6: Focused Smoke Coverage and Full Verification

**Files:**
- Modify: `.github/workflows/mkety-platform-core-workspaces-smoke.yml`

**Interfaces:**
- Consumes: all new HTTP/runtime test files.
- Produces: branch-level regression coverage for Automation execution.

- [ ] **Step 1: Add focused smoke coverage**

Add these test files to the workspace smoke command:

```text
src/features/projects/workspaces/automation/workflow-runtime-readiness.test.ts
src/features/projects/workspaces/automation/http-action-runtime.test.ts
src/features/projects/workspaces/automation/internal-execution-kernel.test.ts
src/features/projects/workspaces/automation/manual-run-foundation.test.ts
src/features/projects/workspaces/automation/AutomationWorkflowManualRunForm.test.tsx
```

- [ ] **Step 2: Run the focused Automation suite**

```bash
pnpm test -- src/features/projects/workspaces/automation/workflow-runtime-readiness.test.ts src/features/projects/workspaces/automation/http-action-runtime.test.ts src/features/projects/workspaces/automation/internal-execution-kernel.test.ts src/features/projects/workspaces/automation/manual-run-foundation.test.ts src/features/projects/workspaces/automation/AutomationWorkflowManualRunForm.test.tsx
```

Expected: PASS.

- [ ] **Step 3: Run full verification**

```bash
pnpm test
pnpm type-check
pnpm lint
pnpm build
```

Expected: all commands exit successfully.

- [ ] **Step 4: Push one implementation checkpoint and inspect GitHub Actions**

Confirm on the exact final feature commit:
- full CI Test success;
- Type-check success;
- Lint success;
- Build success;
- Mkety Platform Core Workspaces Smoke success.

Do not manually rerun successful jobs. If a concrete job fails, inspect that job's logs and fix only the demonstrated root cause.

---

## Plan Self-Review

- Spec coverage: all approved HTTP adapter requirements are assigned to Tasks 1–6.
- Security coverage: HTTPS-only runtime, SSRF protection, guarded DNS lookup, timeout, response cap, redirect blocking, credential/header exclusion, and bounded persisted previews are explicit.
- Runtime architecture: one async execution kernel and one `workflowRuns` lifecycle are preserved; no second runtime is introduced.
- Future blueprint compatibility: execution context and dedicated action boundary support later Agent, webhook, retry, usage-accounting, and connector phases without implementing them now.
- Placeholder scan: no TBD/TODO/"implement later" placeholders remain.
- Type consistency: runtime readiness, HTTP adapter, execution context, execution result, and manual-run interfaces are named consistently across tasks.

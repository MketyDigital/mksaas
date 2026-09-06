# Mkety Automation Agent Action Runtime Adapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add published-version, tool-disabled Agent actions to the existing Mkety Automation execution pipeline without creating a second runtime or weakening tenant/project isolation.

**Architecture:** Extend the current unified async workflow executor with a dedicated Automation→AI adapter. Keep pure runtime capability validation separate from scoped dependency readiness, resolve only published Agent versions inside the current tenant/project, execute through the existing AI provider/model/knowledge path with tools forcibly disabled, and persist only bounded workflow-safe metadata through the existing `workflowRuns` lifecycle.

**Tech Stack:** Next.js 16, TypeScript, Drizzle ORM, AI SDK, Jest, Testing Library, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-06-mkety-automation-agent-action-runtime-adapter-design.md`

## Global Constraints

- `AGENTS.md` remains the architectural source of truth.
- Automation remains independent from AI; Agent is one action adapter inside the workflow engine.
- Only published Agent versions may execute from Automation.
- Agent version lookup must be tenant scoped and project scoped.
- Mutable Agent drafts must never be the authoritative Automation runtime definition.
- Agent tools must be disabled for Automation in this phase even if the published version contains tool configuration.
- Agent prompts use existing workflow interpolation.
- No raw provider response objects, API keys, credentials, unrestricted tool payloads, or hidden provider diagnostics may be persisted in workflow output.
- No webhook activation, schedules, retries, OAuth/connectors, billing deductions, Deploy actions, Trading actions, arbitrary JavaScript, or `eval` are introduced.
- No database migration is planned.
- Do not route Automation through Agent UI/server actions.
- Existing guarded HTTP execution behavior must remain unchanged.

---

### Task 1: Pure Agent Runtime Capability Readiness

**Files:**
- Modify: `src/features/projects/workspaces/automation/workflow-runtime-readiness.ts`
- Modify: `src/features/projects/workspaces/automation/workflow-runtime-readiness.test.ts`

**Interfaces:**
- Consumes: workflow definition only.
- Produces: existing `AutomationWorkflowRuntimeReadiness` result.

- [ ] **Step 1: Add failing tests**

Add cases proving:

```ts
expect(validateAutomationWorkflowRuntimeReadiness({ nodes: [
  { id: 'trigger-1', type: 'trigger', config: {} },
  { id: 'agent-1', type: 'agent', config: { agentId: 'agent-a', prompt: 'Summarize {{http.body}}' } },
] }).ready).toBe(true);

expect(validateAutomationWorkflowRuntimeReadiness({ nodes: [
  { id: 'agent-1', type: 'agent', config: { agentId: '', prompt: 'Hello' } },
] }).blockers).toEqual(expect.arrayContaining([
  expect.objectContaining({ code: 'agent.runtime-agent-required', nodeId: 'agent-1' }),
]));

expect(validateAutomationWorkflowRuntimeReadiness({ nodes: [
  { id: 'agent-1', type: 'agent', config: { agentId: 'agent-a', prompt: '' } },
] }).blockers).toEqual(expect.arrayContaining([
  expect.objectContaining({ code: 'agent.runtime-prompt-required', nodeId: 'agent-1' }),
]));
```

Also retain unknown-node blocking and all HTTP readiness tests.

- [ ] **Step 2: Run focused test and verify red**

```bash
pnpm test -- src/features/projects/workspaces/automation/workflow-runtime-readiness.test.ts
```

Expected: FAIL because Agent nodes are still categorically disabled.

- [ ] **Step 3: Implement minimal capability change**

Rules:
- `agent` becomes a supported runtime-capability node type;
- `agentId` must be a non-empty string;
- `prompt` must be a non-empty string before interpolation;
- no DB access is added here;
- no input mutation.

- [ ] **Step 4: Run focused test and verify green**

```bash
pnpm test -- src/features/projects/workspaces/automation/workflow-runtime-readiness.test.ts
```

Expected: PASS.

---

### Task 2: Scoped Agent Dependency Resolver

**Files:**
- Create: `src/features/projects/workspaces/automation/agent-dependency-readiness.ts`
- Create: `src/features/projects/workspaces/automation/agent-dependency-readiness.test.ts`

**Interfaces:**
- Consumes:

```ts
export type AutomationAgentDependencyContext = {
  tenantId: string;
  projectId: string;
};
```

- Produces:

```ts
export type AutomationAgentDependency = {
  nodeId: string;
  agentId: string;
  versionId: string;
  version: number;
  name: string;
  instructions: string | null;
  provider: string;
  model: string | null;
  config: string | null;
};

export type AutomationWorkflowDependencyReadiness = {
  ready: boolean;
  blockers: Array<{ code: string; message: string; nodeId?: string }>;
  agents: Record<string, AutomationAgentDependency>;
};

export async function resolveAutomationWorkflowDependencies(args: {
  context: AutomationAgentDependencyContext;
  definition: unknown;
}): Promise<AutomationWorkflowDependencyReadiness>;
```

- [ ] **Step 1: Write failing resolver tests**

Mock Drizzle queries and cover:
- same-tenant/project published Agent resolves;
- draft-only/no-published version blocks with `agent.dependency-no-published-version`;
- missing Agent blocks with `agent.dependency-not-found`;
- cross-tenant Agent cannot resolve;
- cross-project Agent cannot resolve;
- two Agent nodes resolve independently;
- returned map is keyed by workflow node ID;
- workflow definition is not mutated.

- [ ] **Step 2: Run focused test and verify red**

```bash
pnpm test -- src/features/projects/workspaces/automation/agent-dependency-readiness.test.ts
```

Expected: FAIL because resolver does not exist.

- [ ] **Step 3: Implement scoped published-version resolution**

For every Agent node:
1. read `node.id` and `config.agentId`;
2. resolve the Agent row using `agents.id + tenantId + projectId`;
3. resolve the published version using `agentVersions.agentId + tenantId + projectId + status='published'`;
4. return immutable version fields from `agentVersions`, not mutable runtime configuration from `agents`;
5. collect blockers instead of throwing for readiness failures.

Do not expose secrets or unrelated Agent fields.

- [ ] **Step 4: Run focused test and verify green**

```bash
pnpm test -- src/features/projects/workspaces/automation/agent-dependency-readiness.test.ts
```

Expected: PASS.

---

### Task 3: Tool-Disabled AI Runtime Entry Point

**Files:**
- Modify: `src/features/ai/lib/agent-runtime.ts`
- Create or modify: `src/features/ai/lib/agent-runtime.test.ts`

**Interfaces:**
- Add:

```ts
export type AgentAutomationExecutionOptions = {
  tools: 'disabled';
};

export async function runAgentForAutomation(
  agent: AgentRuntimeDefinition,
  messages: ModelMessage[],
  options: AgentAutomationExecutionOptions,
): Promise<{
  text: string;
  usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
}>;
```

- [ ] **Step 1: Write failing AI-runtime tests**

Mock model/provider/knowledge dependencies and prove:
- published immutable definition can be executed non-streaming;
- system instructions/provider/model/knowledge path are reused;
- `createAgentTools` is not used for Automation execution or receives an empty set according to the chosen internal factoring;
- configured Agent tools cannot run;
- returned object contains only text plus normalized usage fields;
- disabled Agent definition is rejected if current runtime semantics require that state check.

- [ ] **Step 2: Run focused test and verify red**

```bash
pnpm test -- src/features/ai/lib/agent-runtime.test.ts
```

Expected: FAIL because the Automation-safe entry point does not exist.

- [ ] **Step 3: Refactor shared preparation without duplicating provider logic**

Preserve existing `runAgent()` and `testAgent()` behavior. Extract the minimum common preparation necessary so `runAgentForAutomation()`:
- reuses provider/model resolution;
- reuses system-prompt construction;
- reuses scoped knowledge retrieval;
- forces `tools: {}`;
- uses one non-streaming `generateText()` call;
- normalizes usage if present;
- does not return raw provider response objects.

- [ ] **Step 4: Run AI runtime tests and verify green**

```bash
pnpm test -- src/features/ai/lib/agent-runtime.test.ts
```

Expected: PASS.

---

### Task 4: Automation Agent Action Adapter

**Files:**
- Create: `src/features/projects/workspaces/automation/agent-action-runtime.ts`
- Create: `src/features/projects/workspaces/automation/agent-action-runtime.test.ts`

**Interfaces:**
- Consumes resolved immutable dependency from Task 2.
- Produces:

```ts
export type AutomationAgentExecutionInput = {
  dependency: AutomationAgentDependency;
  tenantId: string;
  projectId: string;
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

export async function executeAutomationAgentAction(
  input: AutomationAgentExecutionInput,
): Promise<AutomationAgentExecutionResult>;
```

- [ ] **Step 1: Write failing adapter tests**

Mock `runAgentForAutomation()` and cover:
- immutable version fields are converted into `AgentRuntimeDefinition`;
- tenant/project IDs are passed from the workflow context, not inferred from user input;
- prompt is sent as a single user message;
- tool-disabled option is mandatory;
- result text is returned;
- preview is bounded to 4096 characters;
- usage is normalized when present;
- provider/model/version metadata are retained;
- thrown provider errors become a sanitized `Automation Agent action failed.` error without leaking raw secrets/provider objects.

- [ ] **Step 2: Run focused test and verify red**

```bash
pnpm test -- src/features/projects/workspaces/automation/agent-action-runtime.test.ts
```

Expected: FAIL because adapter does not exist.

- [ ] **Step 3: Implement adapter**

Use only the immutable dependency fields plus execution context. Never query mutable Agent configuration here. Never import Agent UI/server actions.

- [ ] **Step 4: Run focused test and verify green**

```bash
pnpm test -- src/features/projects/workspaces/automation/agent-action-runtime.test.ts
```

Expected: PASS.

---

### Task 5: Unified Kernel Agent Dispatch

**Files:**
- Modify: `src/features/projects/workspaces/automation/internal-execution-kernel.ts`
- Modify: `src/features/projects/workspaces/automation/internal-execution-kernel.test.ts`

**Interfaces:**
- Extend execution input with resolved dependencies:

```ts
export type AutomationResolvedDependencies = {
  agents: Record<string, AutomationAgentDependency>;
};
```

- Agent step shape:

```ts
agent?: {
  agentId: string;
  versionId: string;
  version: number;
  provider: string;
  model: string | null;
  durationMs: number;
  outputPreview: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
};
```

- [ ] **Step 1: Extend kernel tests before implementation**

Add cases for:
- transform → Agent executes in order;
- HTTP → Agent prompt consumes current `http.body` data;
- Agent → transform consumes `{{agent.text}}`;
- Agent output stores `{ nodeId, agentId, versionId, version, text }` in `data.agent`;
- false condition skips Agent and Agent adapter mock is never called;
- unsupported future node anywhere blocks before any HTTP or Agent adapter call;
- missing resolved dependency for an Agent node fails before Agent side effect;
- input remains immutable;
- existing HTTP behavior remains green.

- [ ] **Step 2: Run kernel test and verify red**

```bash
pnpm test -- src/features/projects/workspaces/automation/internal-execution-kernel.test.ts
```

Expected: FAIL because Agent is not yet dispatched.

- [ ] **Step 3: Implement Agent node dispatch**

For Agent nodes:
1. retrieve dependency by node ID;
2. interpolate current `config.prompt` against current workflow data;
3. reject an empty resolved prompt;
4. call `executeAutomationAgentAction()`;
5. merge sanitized output under `data.agent`;
6. append bounded Agent metadata to the execution step.

Keep the pre-execution unsupported-node scan so unknown nodes block before any side effect. Do not reintroduce Agent as an unsupported type.

- [ ] **Step 4: Run kernel test and verify green**

```bash
pnpm test -- src/features/projects/workspaces/automation/internal-execution-kernel.test.ts
```

Expected: PASS.

---

### Task 6: Manual Run Admission and Failure Lifecycle

**Files:**
- Modify: `src/features/projects/workspaces/automation/actions.ts`
- Modify: `src/features/projects/workspaces/automation/manual-run-foundation.ts`
- Modify: `src/features/projects/workspaces/automation/manual-run-foundation.test.ts`

**Interfaces:**
- Add helper:

```ts
export function assertManualRunDependencyReady(
  readiness: AutomationWorkflowDependencyReadiness,
): void;
```

- [ ] **Step 1: Write failing lifecycle/helper tests**

Cover:
- dependency readiness with `ready: true` accepted;
- dependency blocker rejected with exact message `Workflow dependencies must be fully ready before a manual run can start.`;
- helper does not mutate readiness input.

- [ ] **Step 2: Run helper test and verify red**

```bash
pnpm test -- src/features/projects/workspaces/automation/manual-run-foundation.test.ts
```

Expected: FAIL until dependency guard is implemented.

- [ ] **Step 3: Update manual action admission sequence**

Exact order:

```text
authorize
→ static preflight
→ pure runtime readiness
→ resolve scoped dependencies
→ assert dependency readiness
→ overlapping queued/running guard
→ insert queued run
→ mark running
→ execute unified workflow with resolved dependencies
→ persist completed output
→ or persist sanitized failed error
→ redirect
```

Dependency blockers must occur before `workflowRuns.insert()`.

Execution failures after run creation must continue to mark the scoped run as `failed` with `completedAt`.

- [ ] **Step 4: Run helper/kernel tests and verify green**

```bash
pnpm test -- src/features/projects/workspaces/automation/manual-run-foundation.test.ts src/features/projects/workspaces/automation/internal-execution-kernel.test.ts
```

Expected: PASS.

---

### Task 7: Builder Dependency Readiness UI

**Files:**
- Modify: `src/features/projects/workspaces/automation/data.ts`
- Modify: `src/features/projects/workspaces/automation/AutomationWorkflowManualRunForm.tsx`
- Modify: `src/features/projects/workspaces/automation/AutomationWorkflowManualRunForm.test.tsx`
- Modify if required: `src/app/(tenant)/t/[tenant]/projects/[project]/automation/[workflow]/page.tsx`

**Interfaces:**
- Builder snapshot adds:

```ts
dependencyReadiness: AutomationWorkflowDependencyReadiness;
```

- [ ] **Step 1: Write failing UI tests**

Required assertions:
- clean static/runtime/dependency readiness enables `Run workflow`;
- missing published Agent version disables run;
- blocker message is rendered;
- copy states Agent actions execute the published version;
- copy states Agent tools, webhooks, retries, credentials, and schedules remain disabled;
- non-manager remains protected;
- no Retry/Activate/Publish controls appear.

- [ ] **Step 2: Run UI test and verify red**

```bash
pnpm test -- src/features/projects/workspaces/automation/AutomationWorkflowManualRunForm.test.tsx
```

Expected: FAIL against current props/copy.

- [ ] **Step 3: Compute dependency readiness server-side**

`getAutomationBuilderSnapshot()` must call `resolveAutomationWorkflowDependencies()` with the current tenant/project and definition. Do not send raw workflow definitions to the client solely to perform dependency resolution.

Button readiness becomes:

```ts
const ready =
  preflight.readyForExecutionFoundation &&
  preflight.errorCount === 0 &&
  preflight.warningCount === 0 &&
  runtimeReadiness.ready &&
  dependencyReadiness.ready;
```

Render blocker messages using the already-sanitized dependency readiness result.

- [ ] **Step 4: Run UI test and verify green**

```bash
pnpm test -- src/features/projects/workspaces/automation/AutomationWorkflowManualRunForm.test.tsx
```

Expected: PASS.

---

### Task 8: Focused Smoke and Full Verification

**Files:**
- Modify: `.github/workflows/mkety-platform-core-workspaces-smoke.yml`

- [ ] **Step 1: Add focused coverage**

Ensure the workspace smoke includes:

```text
src/features/projects/workspaces/automation/workflow-runtime-readiness.test.ts
src/features/projects/workspaces/automation/agent-dependency-readiness.test.ts
src/features/projects/workspaces/automation/agent-action-runtime.test.ts
src/features/projects/workspaces/automation/internal-execution-kernel.test.ts
src/features/projects/workspaces/automation/manual-run-foundation.test.ts
src/features/projects/workspaces/automation/AutomationWorkflowManualRunForm.test.tsx
src/features/ai/lib/agent-runtime.test.ts
```

- [ ] **Step 2: Run focused suite**

```bash
pnpm test -- src/features/projects/workspaces/automation/workflow-runtime-readiness.test.ts src/features/projects/workspaces/automation/agent-dependency-readiness.test.ts src/features/projects/workspaces/automation/agent-action-runtime.test.ts src/features/projects/workspaces/automation/internal-execution-kernel.test.ts src/features/projects/workspaces/automation/manual-run-foundation.test.ts src/features/projects/workspaces/automation/AutomationWorkflowManualRunForm.test.tsx src/features/ai/lib/agent-runtime.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run full verification**

```bash
pnpm test
pnpm type-check
pnpm lint
pnpm build
```

Expected: all exit 0.

- [ ] **Step 4: Verify GitHub Actions on exact final head**

Require fresh evidence for:
- CI Test = success;
- CI Type-check = success;
- CI Lint = success;
- CI Build = success;
- Mkety Platform Core Workspaces Smoke = success.

If a failure occurs, invoke `superpowers:systematic-debugging`, identify root cause, make only the minimal fix, and rerun verification.

- [ ] **Step 5: Final architecture check**

Confirm:
- no webhook/schedule activation;
- no retries;
- no billing mutation;
- no Trading or Deploy side effects;
- no Agent tools during Automation execution;
- no direct use of Agent UI/server actions;
- Agent lookup remains tenant/project scoped and published-version only;
- HTTP regression tests remain green;
- PR remains draft/unmerged unless explicitly requested otherwise.

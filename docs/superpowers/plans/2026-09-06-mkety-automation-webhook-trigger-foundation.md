# Mkety Automation Webhook Trigger Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a secure webhook trigger ingress for Mkety Automation that authenticates, deduplicates, audits, and executes webhook-triggered workflows through the existing unified workflow runtime.

**Architecture:** Add dedicated webhook endpoint and delivery persistence, a pure crypto/request-validation layer, a DB-backed admission layer, and a public Next.js route that resolves an active webhook workflow then calls the same readiness/dependency/run/execution pipeline already used by manual runs. Workflow-level `triggerType` becomes authoritative and trigger-node `triggerMode` must match it during preflight.

**Tech Stack:** Next.js App Router, TypeScript, Drizzle ORM/PostgreSQL, Node `crypto`, Jest/Testing Library, existing Mkety Automation runtime.

**Spec:** `docs/superpowers/specs/2026-09-06-mkety-automation-webhook-trigger-foundation-design.md`

## Global Constraints

- Webhook endpoint: `POST /api/automation/webhooks/[endpointId]`.
- `endpointId` is public routing identity, never an authorization secret.
- Require `Content-Type: application/json` with optional charset.
- Maximum raw request body: 256 KiB.
- Require `X-Mkety-Signature: sha256=<lowercase hex digest>` using HMAC-SHA256 over exact raw body bytes.
- Compare signatures in constant time.
- Raw webhook secret is shown only at create/rotate time; persist only a hash/digest.
- `X-Mkety-Event-Id` is optional; otherwise derive deterministic SHA-256 event identity from endpoint + raw body.
- Database uniqueness, not application check-then-insert, prevents duplicate admitted deliveries.
- Only active workflows with `triggerType = webhook` may execute from public ingress.
- Trigger node `config.triggerMode` must equal workflow-level `triggerType` during preflight.
- Reuse the existing static preflight, runtime readiness, Agent dependency resolution, run lifecycle, HTTP adapter, Agent adapter, and execution kernel.
- Webhook execution remains synchronous in this foundation. Return `200` after successful completion; do not return `202` without durable execution handoff.
- No provider-specific signature adapters, retries, schedules, queue/worker, OAuth/connectors, arbitrary inbound header forwarding, Agent tools, Deploy actions, or Trading actions.

---

### Task 1: Persist webhook endpoints and delivery admissions

**Files:**
- Create: `src/shared/db/schema/workflow-webhook-endpoints.ts`
- Create: `src/shared/db/schema/workflow-webhook-deliveries.ts`
- Modify: `src/shared/db/schema/index.ts`
- Create/modify the next Drizzle migration files under the repository's existing migration directory.
- Test: schema/migration assertions in the repository's existing schema test pattern.

**Interfaces:**
- Produces `workflowWebhookEndpoints` with tenant/project/workflow scope, unique `endpointId`, `secretHash`, status, timestamps.
- Produces `workflowWebhookDeliveries` with scoped endpoint/workflow identity, unique `(webhookEndpointId, eventId)`, payload hash, admission status, nullable workflowRunId, timestamps, safe error code.

- [ ] **Step 1: Write failing schema tests**

Assert exported tables include the required columns and unique delivery identity. Include cascade references to tenant, project, workflow and endpoint. Test that the old `workflows.webhookSecret` field is not used by new webhook helpers rather than removing it in this phase.

- [ ] **Step 2: Run focused schema tests and confirm RED**

Run the smallest schema test command used by this repository. Expected failure: missing webhook endpoint/delivery schema exports.

- [ ] **Step 3: Implement schema + migration**

Use repository naming conventions. Recommended column model:

```ts
workflowWebhookEndpoints: {
  id: uuid primary key,
  tenantId,
  projectId,
  workflowId,
  endpointId: varchar unique not null,
  secretHash: varchar not null,
  status: varchar default 'active',
  createdAt,
  updatedAt,
  rotatedAt nullable,
}

workflowWebhookDeliveries: {
  id: uuid primary key,
  tenantId,
  projectId,
  workflowId,
  webhookEndpointId,
  eventId: varchar not null,
  eventIdSource: varchar not null,
  payloadHash: varchar not null,
  status: varchar not null,
  workflowRunId nullable,
  errorCode nullable,
  receivedAt,
  admittedAt nullable,
}
```

Add a unique index on `(webhookEndpointId, eventId)` and normal tenant/project/workflow indexes.

- [ ] **Step 4: Run focused schema tests and migration/type-check checks**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/shared/db/schema migrations
git commit -m "feat: add automation webhook persistence"
```

### Task 2: Add webhook crypto and raw request validation

**Files:**
- Create: `src/features/projects/workspaces/automation/webhook-security.ts`
- Test: `src/features/projects/workspaces/automation/webhook-security.test.ts`

**Interfaces:**
- Produces:

```ts
export const MAX_WEBHOOK_BODY_BYTES = 256 * 1024;
export function generateWebhookCredentials(): { endpointId: string; secret: string; secretHash: string };
export function hashWebhookSecret(secret: string): string;
export function verifyWebhookSignature(args: { secret: string; rawBody: Uint8Array; signatureHeader: string | null }): boolean;
export function validateWebhookContentType(contentType: string | null): void;
export function parseWebhookJsonObject(rawBody: Uint8Array): Record<string, unknown>;
export function normalizeWebhookEventId(value: string | null): string | null;
export function deriveWebhookEventId(endpointId: string, rawBody: Uint8Array): string;
export function hashWebhookPayload(rawBody: Uint8Array): string;
```

- [ ] **Step 1: Write failing tests**

Cover credential uniqueness/format, secret hashing, valid HMAC, missing signature, malformed prefix, wrong digest, constant-length comparison path, JSON content-type with charset, non-JSON rejection, 256 KiB boundary, malformed JSON, non-object JSON rejection, external event ID length/control characters, deterministic derived event IDs and payload hashes.

- [ ] **Step 2: Run test and confirm RED**

Expected: module missing.

- [ ] **Step 3: Implement minimal pure security helpers**

Use Node `crypto.randomBytes`, `createHash`, `createHmac`, and `timingSafeEqual`. Require lowercase 64-character hex after `sha256=`. Keep the module free of DB/network/UI imports.

- [ ] **Step 4: Run tests and type-check**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/projects/workspaces/automation/webhook-security*
git commit -m "feat: add automation webhook security policy"
```

### Task 3: Make workflow trigger type authoritative in preflight

**Files:**
- Modify: `src/features/projects/workspaces/automation/workflow-preflight.ts`
- Modify: `src/features/projects/workspaces/automation/workflow-preflight.test.ts`
- Modify workflow builder/server call sites that currently call preflight without workflow trigger context.

**Interfaces:**
- Extend preflight input so validation can compare workflow-level `triggerType` with trigger-node `config.triggerMode` without adding DB access to the pure validator.

Recommended signature:

```ts
validateAutomationWorkflowDefinition(definition, { triggerType?: string } = {})
```

- [ ] **Step 1: Add failing mismatch tests**

Cases:
- workflow `manual` + node `manual` => ready;
- workflow `webhook` + node `webhook` => ready structurally;
- workflow `webhook` + node `manual` => preflight error;
- workflow `manual` + node `webhook` => preflight error;
- schedule remains recognized but runtime readiness remains disabled.

- [ ] **Step 2: Run focused tests and confirm RED**

Expected mismatch cases are not currently rejected.

- [ ] **Step 3: Implement pure trigger consistency rule and update callers**

Do not infer workflow-level trigger mode from the node. The workflow row is authoritative.

- [ ] **Step 4: Run preflight, manual-run, builder and type-check tests**

Expected: PASS with no manual-run regression.

- [ ] **Step 5: Commit**

```bash
git add src/features/projects/workspaces/automation

git commit -m "feat: align automation trigger admission semantics"
```

### Task 4: Add webhook endpoint management helpers

**Files:**
- Create: `src/features/projects/workspaces/automation/webhook-endpoints.ts`
- Test: `src/features/projects/workspaces/automation/webhook-endpoints.test.ts`
- Modify: `src/features/projects/workspaces/automation/actions.ts`

**Interfaces:**
- Produces scoped helpers/actions for manager-only create, rotate, disable and read endpoint metadata.
- Creation/rotation returns the raw secret exactly once from the action result; persistent reads never return raw secret or hash.

Recommended service interfaces:

```ts
createWorkflowWebhookEndpoint({ tenantId, projectId, workflowId }): Promise<{ endpointId: string; secret: string }>;
rotateWorkflowWebhookSecret({ tenantId, projectId, workflowId, endpointId }): Promise<{ secret: string }>;
disableWorkflowWebhookEndpoint(...): Promise<void>;
getWorkflowWebhookEndpoint(...): Promise<{ endpointId: string; status: string } | null>;
```

- [ ] **Step 1: Write failing tests with DB mocks**

Cover same-scope workflow requirement, webhook-trigger requirement for creation, secret hash persistence, no raw secret persistence, rotation replacing hash + timestamp, disable behavior, and no secret/hash exposure from reads.

- [ ] **Step 2: Run focused tests and confirm RED**

- [ ] **Step 3: Implement scoped endpoint helpers and manager actions**

Reuse existing access/capability checks from workflow actions. Never write `workflows.webhookSecret`.

- [ ] **Step 4: Run focused tests/type-check**

- [ ] **Step 5: Commit**

```bash
git add src/features/projects/workspaces/automation/webhook-endpoints* src/features/projects/workspaces/automation/actions.ts
git commit -m "feat: add webhook endpoint management"
```

### Task 5: Add concurrency-safe webhook delivery admission

**Files:**
- Create: `src/features/projects/workspaces/automation/webhook-delivery-admission.ts`
- Test: `src/features/projects/workspaces/automation/webhook-delivery-admission.test.ts`

**Interfaces:**

```ts
export type WebhookAdmissionResult =
  | { status: 'admitted'; deliveryId: string }
  | { status: 'duplicate'; deliveryId?: string }
  | { status: 'busy'; deliveryId: string };

admitWebhookDelivery(args: {
  tenantId: string;
  projectId: string;
  workflowId: string;
  webhookEndpointId: string;
  eventId: string;
  eventIdSource: 'external' | 'derived';
  payloadHash: string;
}): Promise<WebhookAdmissionResult>;

associateWebhookDeliveryRun(args: { deliveryId: string; workflowRunId: string }): Promise<void>;
markWebhookDeliveryFailure(args: { deliveryId: string; errorCode: string }): Promise<void>;
```

- [ ] **Step 1: Write failing tests**

Cover unique event admission, duplicate DB conflict mapped to `duplicate`, tenant/project/workflow scoping, and busy workflow behavior without silently dropping the delivery.

- [ ] **Step 2: Run focused test and confirm RED**

- [ ] **Step 3: Implement using database conflict handling**

Do not implement dedupe as `findFirst()` followed by `insert()`. Use the unique constraint and conflict-safe insertion/transaction pattern supported by the existing Drizzle setup.

For workflow concurrency, reuse the current queued/running policy through one shared helper if possible. If current admission remains application-level, keep the limitation explicit and ensure duplicate-delivery admission itself is atomic.

- [ ] **Step 4: Run tests and type-check**

- [ ] **Step 5: Commit**

```bash
git add src/features/projects/workspaces/automation/webhook-delivery-admission*
git commit -m "feat: add webhook delivery admission"
```

### Task 6: Extract one shared workflow execution admission/service path

**Files:**
- Create: `src/features/projects/workspaces/automation/workflow-execution-service.ts`
- Test: `src/features/projects/workspaces/automation/workflow-execution-service.test.ts`
- Modify: `src/features/projects/workspaces/automation/actions.ts`
- Modify: `src/features/projects/workspaces/automation/manual-run-foundation.ts` only where necessary.

**Interfaces:**
- Produces one server-side function used by both manual and webhook ingress after their different authentication/admission steps.

Recommended interface:

```ts
executeAutomationWorkflowRun({
  workflow,
  triggerType,
  input,
  dependencies,
}: {
  workflow: Workflow;
  triggerType: 'manual' | 'webhook';
  input: Record<string, unknown>;
  dependencies: AutomationWorkflowDependencyReadiness;
}): Promise<{ runId: string; output: Record<string, unknown> }>;
```

- [ ] **Step 1: Write failing tests**

Assert queued -> running -> completed lifecycle, failed lifecycle, scoped run updates, `triggerType` persistence, input persistence, no duplicated HTTP/Agent execution logic, and manual behavior remains equivalent.

- [ ] **Step 2: Run focused tests and confirm RED**

- [ ] **Step 3: Extract the shared service and migrate manual action to it**

The service must call existing `executeAutomationWorkflowDefinition`. It must not know anything about HMAC, endpoint IDs or HTTP route semantics.

- [ ] **Step 4: Run manual-run, kernel, HTTP, Agent and service tests**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/projects/workspaces/automation

git commit -m "refactor: share automation workflow execution service"
```

### Task 7: Implement public webhook ingress route

**Files:**
- Create: `src/app/api/automation/webhooks/[endpointId]/route.ts`
- Create: route tests using the repository's route-handler test pattern.
- Create small server helper file if needed to keep route under ~100-150 lines.

**Interfaces:**
- Consumes webhook security, endpoint resolution, preflight, runtime readiness, Agent dependency resolution, delivery admission and shared execution service.

- [ ] **Step 1: Write failing route tests**

Cover:
- GET/other method unavailable or `405` according to Next route behavior;
- unknown/disabled endpoint -> `404`;
- missing/bad signature -> `401`;
- wrong content type -> `415`;
- payload >256 KiB -> `413`;
- malformed/non-object JSON -> `400` or `422` per helper contract, choose one consistently;
- inactive/wrong-trigger/not-ready workflow -> `422`;
- duplicate event -> `409` and no workflow run;
- busy workflow -> `409` and delivery retained as non-admitted/busy;
- valid webhook -> workflow input equals JSON payload, run triggerType `webhook`, execution path invoked, response `200` with generic body;
- execution failure -> failed run persisted, delivery marked with safe code, response `500` without stack/provider details.

- [ ] **Step 2: Run route tests and confirm RED**

- [ ] **Step 3: Implement bounded raw-body route**

Read raw bytes without parsing first. Authenticate before `JSON.parse`. Resolve endpoint without exposing tenant/project identifiers in responses. Use exact response policy from spec.

- [ ] **Step 4: Run route + complete Automation tests**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/automation/webhooks src/features/projects/workspaces/automation
git commit -m "feat: add automation webhook ingress"
```

### Task 8: Add minimal webhook management panel to workflow builder

**Files:**
- Create: `src/features/projects/workspaces/automation/AutomationWorkflowWebhookPanel.tsx`
- Test: `src/features/projects/workspaces/automation/AutomationWorkflowWebhookPanel.test.tsx`
- Modify workflow builder page/data loader to pass endpoint metadata.
- Modify: `.github/workflows/mkety-platform-core-workspaces-smoke.yml`

**Interfaces:**
- Manager-only controls for create, rotate and disable.
- Public URL display uses endpoint ID.
- One-time secret is shown only from create/rotate result state, not normal page data.

- [ ] **Step 1: Write failing UI tests**

Cover:
- webhook workflow with no endpoint shows create control for managers;
- active endpoint shows public URL, signature header instructions and event ID behavior;
- non-manager sees read-only/protected state;
- one-time secret UI appears only after create/rotate action result;
- manual-trigger workflow does not offer webhook activation;
- no provider-specific webhook UI or retry controls.

- [ ] **Step 2: Run focused UI tests and confirm RED**

- [ ] **Step 3: Implement minimal panel and wire actions**

Keep copy explicit: secret is shown once, signature is HMAC-SHA256 of raw body, workflow must be active and webhook-triggered.

- [ ] **Step 4: Add all webhook tests to focused workspace smoke and run focused tests/type-check**

- [ ] **Step 5: Commit**

```bash
git add src/features/projects/workspaces/automation src/app/'(tenant)' .github/workflows/mkety-platform-core-workspaces-smoke.yml
git commit -m "feat: add webhook management surface"
```

### Task 9: Full regression and security verification

**Files:**
- No product files unless verification discovers a concrete defect.
- Update plan/spec only if actual implementation intentionally deviates from approved contract.

- [ ] **Step 1: Run focused webhook tests**

```bash
pnpm test -- \
  src/features/projects/workspaces/automation/webhook-security.test.ts \
  src/features/projects/workspaces/automation/webhook-endpoints.test.ts \
  src/features/projects/workspaces/automation/webhook-delivery-admission.test.ts \
  src/features/projects/workspaces/automation/workflow-execution-service.test.ts \
  src/features/projects/workspaces/automation/workflow-preflight.test.ts \
  src/features/projects/workspaces/automation/AutomationWorkflowWebhookPanel.test.tsx
```

Also run the route-handler test path created in Task 7.

- [ ] **Step 2: Run existing Automation runtime regression tests**

Include manual run, runtime readiness, Agent dependency, HTTP action, Agent action and internal execution kernel suites.

- [ ] **Step 3: Run full required quality gates**

```bash
pnpm test
pnpm lint
pnpm type-check
pnpm build
```

Expected: all exit 0.

- [ ] **Step 4: Verify security checklist manually from code/tests**

Confirm:
- no raw secret persisted;
- no URL/query secret;
- signature validated before JSON parse;
- constant-time digest compare;
- raw body capped at 256 KiB;
- duplicate delivery uniqueness exists in DB;
- unknown/disabled endpoint does not disclose scope;
- no webhook-specific action runtime fork;
- no Agent tools enabled;
- no `202` response without durable handoff;
- no provider-specific adapters introduced.

- [ ] **Step 5: Create/update a draft PR from `feat/mkety-automation-webhook-trigger` to `main` with exact verification evidence**

Keep it draft while iterating. Do not merge or deploy without explicit user direction.

## Plan Self-Review

- Spec coverage: persistence, one-time secret policy, HMAC/raw-body verification, body/content-type limits, event identity, DB dedupe, trigger source of truth, same runtime pipeline, synchronous response semantics, management surface and safety boundaries are each assigned to a concrete task.
- Placeholder scan: no TBD/TODO/"implement later" placeholders are used as task instructions.
- Type consistency: the plan uses one endpoint record, one delivery admission record, one shared execution service, and the existing Automation dependency/kernel interfaces throughout.
- Scope: provider-specific adapters, retries, schedules and durable workers remain excluded, so this is one implementable milestone rather than several independent subsystems.

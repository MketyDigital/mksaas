# Main Mkety AI Consumer Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move approved main-platform AI consumers onto the central Mkety runtime while preserving their existing trust boundaries, capabilities, entitlements, and product-owned accounting.

**Architecture:** Migrate one consumer at a time to the versioned consumer route contract from the central-control-plane plan. Keep consumer-specific safety, tools, memory, knowledge, API authorization, and usage ledgers at their existing boundaries. Keep old provider paths available until parity tests pass and rollback is documented.

**Tech Stack:** TypeScript, Next.js App Router, Cloudflare Workers AI, provider adapters, Drizzle, Jest.

**Spec:** `docs/superpowers/specs/2026-10-05-mkety-central-ai-provider-runtime-design.md`

## Global Constraints

- Do not read, change, or add dependencies on `customer-apps/assist`.
- Public AI uses managed central routes only and retains its public trust/data policy.
- Workspace/Enterprise BYOK is optional, explicitly selected, and fail-closed on provider failure.
- Enterprise managed inference stays disabled in production.
- Workers AI uses standard billing; no Cloudflare Unified Billing or prepaid frontier-model credits.
- Preserve product-owned usage/credit ledgers and request idempotency.
- No consumer receives provider credentials or bypasses the central model/route policy.

## Review Focus

- Public AI accidentally receives Workspace/Enterprise private routes — test consumer-specific profile resolution in Task 2.
- Existing public moderation, tools, knowledge, memory, or visitor controls change during provider migration — test the public runtime contract in Task 2.
- A legacy Workspace agent suddenly loses execution or silently changes billing source — test legacy compatibility and BYOK source in Task 3.
- Enterprise requests run despite managed-inference being off — test the production-off policy in Task 4.
- A repeated Enterprise request settles twice or attributes BYOK usage to Mkety-managed inference — test idempotency and source accounting in Task 4.

---

## File map

Modify:

- `src/features/ai-runtime/channels/server/runtime.ts`
- `src/features/public-assistant/server/runtime.ts`
- `src/features/public-assistant/server/gateway.ts`
- `src/features/public-assistant/server/providers/index.ts`
- `src/features/public-assistant/server/providers/index.test.ts`
- `src/features/public-assistant/server/support-boundary.test.ts`
- `src/features/ai/lib/agent-runtime.ts`
- `src/features/ai/lib/agent-runtime.test.ts`
- `src/app/api/v1/ai/chat/completions/route.ts`
- Related tests under `src/features/ai-runtime` and `src/features/public-assistant`

Add focused consumer contract tests if a path does not have an existing suite. Do not delete old provider modules until the corresponding consumer passes parity and rollback checks.

---

### Task 1: Register and route channel runtime as a separate consumer

**Files:**
- Modify: `src/features/ai-runtime/channels/server/runtime.ts`
- Add or modify: `src/features/ai-runtime/channels/server/runtime.test.ts`

**Interfaces:**
- Consumes: `runCentralAi` from the central-control-plane plan.
- Produces: channel-specific `consumerKey` and execution context; no customer BYOK unless a channel product policy explicitly supplies an authorized connection ID.

- [ ] **Step 1: Write failing tests** that channel generation supplies its registered consumer key, uses the configured model alias, and returns normalized text/usage without access to provider credentials.
- [ ] **Step 2: Run** `pnpm test -- src/features/ai-runtime/channels/server/runtime.test.ts`. Confirm the new cases fail.
- [ ] **Step 3: Update** the runtime call to pass the channel consumer identity, tenant/project context, and stable idempotency value where the operation can be retried.
- [ ] **Step 4: Run** the targeted suite. Expected: channel routes resolve through central policy and existing channel persistence/delivery behavior is unchanged.
- [ ] **Step 5: Commit** as `feat: route mkety ai channels through central runtime`.

### Task 2: Migrate Public AI provider execution behind the public consumer boundary

**Files:**
- Modify: `src/features/public-assistant/server/runtime.ts`
- Modify: `src/features/public-assistant/server/gateway.ts`
- Modify: `src/features/public-assistant/server/providers/index.ts`
- Modify tests listed in the file map.

**Interfaces:**
- Consumes: central runtime with `consumerKey: 'public-ai'`.
- Preserves: Public AI input/output contract and Public AI-owned moderation, tools, knowledge, memory, visitor identity, and rate limits.

- [ ] **Step 1: Add failing tests** for public route selection isolated from tenant/private profiles, safe provider error mapping, and preserved public tools/knowledge/memory behavior.
- [ ] **Step 2: Run** `pnpm test -- src/features/public-assistant/server/providers/index.test.ts src/features/public-assistant/server/support-boundary.test.ts`. Confirm provider execution cases fail.
- [ ] **Step 3: Adapt** the public runtime to invoke the central managed route with the Public AI consumer identity. Keep policy and orchestration in the Public AI modules; do not make the central runtime own public memory, tools, or visitor state.
- [ ] **Step 4: Run** the listed tests plus `pnpm test -- src/features/public-assistant/server/gateway.test.ts`. Expected: public behavior is unchanged and the central provider route is used.
- [ ] **Step 5: Compare** the old and central paths against the existing Public AI provider contract tests; keep the old provider adapter selected behind the existing config boundary until parity passes.
- [ ] **Step 6: Commit** as `feat: route public mkety ai through central providers`.

### Task 3: Finish Workspace/Agent central runtime migration

**Files:**
- Modify: `src/features/ai/lib/agent-runtime.ts`
- Modify: `src/features/ai/lib/agent-runtime.test.ts`
- Modify: `src/features/ai/lib/agent-runtime-config.ts` only where the provider mode contract requires it.

**Interfaces:**
- Consumes: central runtime with consumer key `workspace-agents`.
- Preserves existing result type `AgentAutomationUsage` and `runAgentForAutomation` tool-disabled behavior.

- [ ] **Step 1: Add failing tests** for platform-managed aliases, authorized `byok:<connectionId>` execution, BYOK failure with no managed fallback, and legacy provider records remaining readable during migration.
- [ ] **Step 2: Run** `pnpm test -- src/features/ai/lib/agent-runtime.test.ts`. Confirm the new policy cases fail.
- [ ] **Step 3: Route** remaining Workspace managed agent requests through the central runtime; require explicit connection selection for BYOK; retain the legacy provider path only for records not yet migrated and make that path observable.
- [ ] **Step 4: Run** the targeted suite and existing agent/tool/knowledge tests. Expected: tool-disabled automation remains tool-disabled, and user-invoked agents preserve enabled tool behavior only where supported by the central capability contract.
- [ ] **Step 5: Commit** as `feat: complete workspace ai central runtime migration`.

### Task 4: Route Workspace knowledge embeddings through the central runtime

**Files:**
- Modify: `src/features/ai/lib/knowledge-provider.ts`
- Modify: `src/features/ai/lib/knowledge-context.ts`
- Modify: `src/features/ai/lib/knowledge-ingestion.ts`
- Modify: `src/features/ai-runtime/providers/central-runtime.ts`
- Add: `src/features/ai/lib/knowledge-provider.test.ts`
- Add or extend focused tests for `knowledge-context.ts` and `knowledge-ingestion.ts`

**Interfaces:**
- Produces: `embedCentralAi(input: { consumerKey: 'workspace-knowledge'; tenantId: string; projectId: string; model: string; text: string }): Promise<{ provider: string; nativeModel: string; vector: number[]; source: 'managed' | 'byok' }>`.
- Changes `embedKnowledgeText` to require tenant/project context from indexing or retrieval callsites.
- Uses only centrally routed models whose catalog capabilities include embeddings; a model without embedding support fails before provider invocation.

- [ ] **Step 1: Write failing tests** that knowledge query embedding and ingestion pass the right tenant/project and `workspace-knowledge` consumer key; empty text and non-embedding models fail without a provider call.
- [ ] **Step 2: Run** `pnpm test -- src/features/ai/lib/knowledge-provider.test.ts`. Confirm these cases fail.
- [ ] **Step 3: Implement** central embedding route resolution and pass explicit workspace/knowledge context from both query and ingestion paths. Preserve the current vector shape and stored dimension contract.
- [ ] **Step 4: Run** the new test plus focused knowledge context/ingestion tests. Expected: vector results remain compatible with stored knowledge and cross-tenant context is never used.
- [ ] **Step 5: Commit** as `feat: route workspace knowledge embeddings centrally`.

### Task 5: Harden Enterprise API integration without enabling managed production inference

**Files:**
- Modify: `src/app/api/v1/ai/chat/completions/route.ts`
- Modify: relevant tests under `src/features/ai-runtime` or add `src/app/api/v1/ai/chat/completions/route.test.ts`

**Interfaces:**
- Consumes: central runtime with consumer key `enterprise-api`.
- Preserves: `Idempotency-Key`, scoped API-key auth, Enterprise entitlement, model/capability checks, admission, reservation, settlement, and reconciliation-required behavior.

- [ ] **Step 1: Add failing route tests** for managed inference disabled (zero provider calls), explicit BYOK selection and attribution, BYOK outage (no managed fallback), duplicate idempotency (one settlement), and unsupported tools/structured output returning a stable policy error.
- [ ] **Step 2: Run** the targeted route test. Confirm the policy and accounting assertions fail where applicable.
- [ ] **Step 3: Pass** the Enterprise API consumer key and stable idempotency key to the central runtime; keep customer BYOK explicit and preserve current managed-inference gate.
- [ ] **Step 4: Run** the route suite plus `pnpm test -- src/features/ai-runtime/server/commercial-admission.test.ts src/features/ai-runtime/server/budget-reservation-service.test.ts`. Expected: existing commercial reservation/settlement behavior is unchanged.
- [ ] **Step 5: Commit** as `feat: enforce enterprise ai central route contract`.

### Task 6: Consumer parity and boundary verification

- [ ] **Step 1: Run** targeted channel, Public AI, Workspace AI, Enterprise API, and central-runtime suites.
- [ ] **Step 2: Run** `pnpm type-check` and `pnpm test -- src/features/public-assistant src/features/ai src/features/ai-runtime`.
- [ ] **Step 3: Verify** no changed path begins with `customer-apps/assist/`; verify Enterprise production inference remains false and no customer receives provider secrets.
- [ ] **Step 4: Record** per-consumer parity results and rollback switches in the release note before removing any legacy provider path.

---

## Completion gate

Do not remove a consumer’s legacy provider path until parity is demonstrated for its supported capabilities and accounting. This plan depends on the route and attempt-evidence contract in `2026-10-05-mkety-central-ai-control-plane.md`.

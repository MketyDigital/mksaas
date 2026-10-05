# Mkety Central AI Control Plane Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the main Mkety Platform use one centrally managed provider catalog, credential boundary, versioned route profile, retry/fallback policy, and per-attempt execution evidence.

**Architecture:** Extend the existing `src/features/ai-runtime` runtime and provider-connection services. Keep product authorization and billing ledgers at their current boundaries; the central service resolves provider/model routes and returns auditable attempt metadata. Preserve legacy route resolution until the new profile path passes parity checks.

**Tech Stack:** TypeScript, Next.js App Router, Drizzle/PostgreSQL, Cloudflare Workers AI binding, Jest, Wrangler.

**Spec:** `docs/superpowers/specs/2026-10-05-mkety-central-ai-provider-runtime-design.md`

## Global Constraints

- Keep `customer-apps/assist` and its production configuration unchanged.
- Managed connections are Mkety-owned and resolved centrally; callers never receive provider secrets.
- Customer BYOK is opt-in and only available to Workspace/Enterprise surfaces where authorized.
- A failed BYOK call never falls through to Mkety-managed spend.
- Workers AI uses standard Workers AI billing; no Cloudflare Unified Billing or prepaid frontier-model credits.
- Keep Enterprise managed inference disabled in production.
- Preserve existing tenant/project authorization, entitlements, and product-owned accounting.

## Review Focus

- Cross-tenant or cross-project route selection — test candidate resolution with overlapping global, tenant, and project profiles in Task 1.
- Invalid or unsupported route-profile data — test malformed provider/model/capability targets fail closed in Task 1.
- BYOK failure causing Mkety-funded inference — test provider outage and missing-key cases never call a managed adapter in Task 2.
- Unsafe retry of a non-idempotent request — test retries require both an eligible transient error and an idempotency key in Task 2.
- Partial fallback success hiding earlier provider spend — test each attempt’s source, model, usage, and failure reason is returned to the owning accounting flow in Task 3.

---

## File map

Create:

- `src/shared/db/migrations/0041_ai_route_profiles.sql`
- `src/features/ai-runtime/server/route-profiles.ts`
- `src/features/ai-runtime/server/route-profiles.test.ts`
- `src/features/ai-runtime/providers/central-runtime.test.ts` additions for fallback and attempt evidence
- `src/features/ai-runtime/server/provider-connections.test.ts`

Modify:

- `src/shared/db/schema/ai-runtime.ts`
- `src/shared/db/schema/index.ts` only if the established schema export requires it
- `src/features/ai-runtime/server/model-routing.ts`
- `src/features/ai-runtime/providers/central-runtime.ts`
- `src/features/ai-runtime/providers/external-types.ts`
- `src/features/ai-runtime/runtime/reliability-policy.ts` and its test
- `docs/MKETY_AI_PRODUCT_COMMERCIAL_SECURITY_SPEC.md`
- `docs/MKETY_AI_RUNTIME_GATEWAY_ARCHITECTURE.md`

Do not create a second provider or credential system. Reuse existing `ai_provider_connections`, `ai_models`, `ai_model_aliases`, `ai_routes`, and secret encryption helpers where they fit.

---

### Task 1: Add versioned, consumer-scoped route profiles

**Files:**
- Create: `src/shared/db/migrations/0041_ai_route_profiles.sql`
- Create: `src/features/ai-runtime/server/route-profiles.ts`
- Create: `src/features/ai-runtime/server/route-profiles.test.ts`
- Create: `src/features/ai-runtime/server/model-routing.test.ts`
- Modify: `src/shared/db/schema/ai-runtime.ts`
- Modify: `src/features/ai-runtime/server/model-routing.ts`

**Interfaces:**
- Produces: `AiRouteTarget` with `modelId`, ordered `priority`, and optional allowed-capability constraints.
- Produces: `resolveAiModelRouteCandidates(input: { consumerKey: string; tenantId: string; projectId?: string | null; requestedModel: string }): Promise<ResolvedAiRouteCandidate[]>`.
- A resolved candidate contains the selected alias, enabled model, provider key, native model, route profile version, target priority, and managed connection mode.

- [ ] **Step 1: Write failing route-profile tests** for active version selection, project-over-tenant-over-platform precedence, priority order, disabled model/target rejection, unknown consumer, and malformed target data.
- [ ] **Step 2: Run** `pnpm test -- src/features/ai-runtime/server/route-profiles.test.ts src/features/ai-runtime/server/model-routing.test.ts`. Confirm the new profile cases fail.
- [ ] **Step 3: Add** an additive `ai_route_profiles` representation in migration `0041_ai_route_profiles.sql` and Drizzle schema. Store consumer key, scope, alias, version, active state, and ordered model targets. Keep published versions readable and preserve legacy `ai_routes` fallback during migration.
- [ ] **Step 4: Implement** the exact resolver signature above. Return only active, enabled, authorized candidates; order scope specificity before route priority; validate target shape before returning it.
- [ ] **Step 5: Run** the targeted tests and `pnpm db:check:migrations`. Expected: all route cases pass and the migration baseline check passes.
- [ ] **Step 6: Commit** the migration, schema, resolver, and tests as `feat: add versioned central ai route profiles`.

### Task 2: Enforce consumer policy and safe retries/fallbacks

**Files:**
- Modify: `src/features/ai-runtime/providers/central-runtime.ts`
- Modify: `src/features/ai-runtime/runtime/reliability-policy.ts`
- Modify: `src/features/ai-runtime/runtime/reliability-policy.test.ts`
- Modify: `src/features/ai-runtime/providers/central-runtime.test.ts`

**Interfaces:**
- Consumes: `resolveAiModelRouteCandidates` from Task 1.
- Modifies: `runCentralAi` to accept required `consumerKey: string` for all non-test callers and optional `providerConnectionId` for authorized BYOK execution.
- Preserves result compatibility while adding `attempts: CentralAiAttemptEvidence[]`; each attempt records provider, model, managed/BYOK source, outcome, usage when returned, provider request ID when returned, and fallback reason.

- [ ] **Step 1: Write failing tests** for a transient managed-provider error followed by success, unsupported-capability fallback rejection, auth/quota failure without retry, exhausted route chain, and failed BYOK with no managed adapter call.
- [ ] **Step 2: Run** `pnpm test -- src/features/ai-runtime/providers/central-runtime.test.ts src/features/ai-runtime/runtime/reliability-policy.test.ts`. Confirm the new cases fail.
- [ ] **Step 3: Implement** bounded candidate fallback and transient retries using the consumer’s versioned policy. Permit retry only when the error class is retryable and the request is idempotent; keep BYOK on its explicit connection for the entire call.
- [ ] **Step 4: Capture** one evidence record per provider attempt, including failures and fallback reason. Do not log prompt content or credentials.
- [ ] **Step 5: Run** the two targeted suites. Expected: managed fallback occurs only for eligible errors; BYOK never changes billing source; attempts remain ordered and complete.
- [ ] **Step 6: Commit** as `feat: enforce central ai route and fallback policy`.

### Task 3: Verify system connection ownership and secret handling

**Files:**
- Create: `src/features/ai-runtime/server/provider-connections.test.ts`
- Modify: `src/features/ai-runtime/server/provider-connections.ts`
- Modify: `src/features/ai-runtime/server/provider-connection-actions.ts` only if the tests reveal a missing system-connection guard

**Interfaces:**
- Consumes: existing `saveSystemAiProviderConnection`, `listSystemAiProviderConnections`, `resolveSystemAiProviderConnection`, and `disableSystemAiProviderConnection`.
- Preserves separate `platform`, `public`, and `byok` ownership modes.

- [ ] **Step 1: Write failing tests** that prove only a system connection in the requested mode can be resolved; disabled/missing connections fail closed; list/action responses omit secret references and plaintext credentials; BYOK resolution remains tenant/project scoped; the system adapter resolves OpenAI, Azure AI Foundry/Azure OpenAI, AWS Bedrock, Gemini, Vertex, and custom OpenAI-compatible connections, while Workers AI uses only the Workers binding.
- [ ] **Step 2: Run** `pnpm test -- src/features/ai-runtime/server/provider-connections.test.ts src/features/ai-runtime/server/byok-secrets.test.ts`. Confirm the new cases fail.
- [ ] **Step 3: Implement** only the guards or redaction fixes demonstrated by those tests. Keep encrypted secret storage in the shared connection-secrets helper.
- [ ] **Step 4: Run** the targeted tests. Expected: all connection ownership and no-secret assertions pass.
- [ ] **Step 5: Commit** as `test: enforce central ai provider connection boundaries`.

### Task 4: Reconcile provider and billing source-of-truth documents

**Files:**
- Modify: `docs/MKETY_AI_PRODUCT_COMMERCIAL_SECURITY_SPEC.md`
- Modify: `docs/MKETY_AI_RUNTIME_GATEWAY_ARCHITECTURE.md`

- [ ] **Step 1: Update** managed-provider ownership, supported-provider list, Workspace/Enterprise BYOK limits, and consumer-specific fallback/accounting rules to match the approved design spec.
- [ ] **Step 2: Add** the binding/billing distinction: Workers AI through standard billing; do not use Unified Billing/prepaid credits for frontier providers.
- [ ] **Step 3: Search** both documents for conflicting statements such as “frontier vendors via BYOK only” when referring to Mkety-owned central connections; resolve contradictions without changing Assist documentation.
- [ ] **Step 4: Commit** as `docs: reconcile central mkety ai provider policy`.

### Task 5: Run central control-plane verification

- [ ] **Step 1: Run** `pnpm test -- src/features/ai-runtime/providers/central-runtime.test.ts src/features/ai-runtime/runtime/reliability-policy.test.ts src/features/ai-runtime/server/model-routing.test.ts src/features/ai-runtime/server/route-profiles.test.ts src/features/ai-runtime/server/provider-connections.test.ts`.
- [ ] **Step 2: Run** `pnpm type-check` and `pnpm db:check:migrations`.
- [ ] **Step 3: Verify** no changed path begins with `customer-apps/assist/` and no production inference setting was enabled.

---

## Completion gate

Task 1 must land before Task 2. The main consumer plan and self-hosted plan consume the route/evidence contract from this plan. Keep production deployment and Cloudflare Gateway mutation in the separate rollout plan.

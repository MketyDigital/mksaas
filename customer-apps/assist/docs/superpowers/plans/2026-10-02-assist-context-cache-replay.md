# Assist Context Cache and Message Replay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Preserve conversation context across transient storage failures and ensure incoming turns are durably accepted before a channel webhook is acknowledged.

**Architecture:** Keep D1 authoritative for prompts, memory, controls, knowledge, and billing. Add short-lived versioned KV snapshots for non-authoritative context reads and a durable inbound queue for webhook receipt/replay. When D1 cannot verify entitlement, pause/handoff state, or a credit reservation, defer the same turn and do not invoke a model.

**Tech Stack:** TypeScript, Cloudflare Workers, D1, KV, Queues, Wrangler, Node 22 built-in test runner.

**Spec:** customer-apps/assist/docs/superpowers/specs/2026-10-02-assist-conversation-context-resilience-design.md

## Global Constraints

- Scope is the independently deployed Mkety Assist application under customer-apps/assist.
- D1 remains the authority for assistant settings, customer controls, message history, knowledge, credits, entitlements, and usage ledger.
- KV contains no secrets, credentials, credit balances, or authoritative business state.
- Prompt/tool cache TTL is 15 minutes; conversation and knowledge snapshot TTL is 5 minutes.
- Cache keys include customer ID and assistant ID, conversation ID where applicable, source versions, and the memory-clear cutoff.
- Paid inference fails closed whenever current account, pause, handoff, rate, or policy state cannot be verified.
- D1 failure must not acknowledge and drop an inbound message; replay must use the same stable provider event and conversation identity.

## Review Focus

- Stale cached prompt or knowledge after an edit must not override a newer D1 version; Task 2 tests version changes.
- A memory clear racing a cache write must not restore deleted context; Task 2 tests the clear cutoff.
- Duplicate webhook delivery must not create duplicate turns; Task 3 tests event deduplication.
- Queue send failure must return a retryable webhook response; Task 3 tests no-ack behavior.
- A KV outage must not break normal D1-backed inference; Task 1 tests fallback to D1.

---

### Task 1: Add an isolated versioned Assist context cache

**Files:**
- Create: customer-apps/assist/src/conversation/context-cache.ts
- Modify: customer-apps/assist/src/index.ts
- Modify: customer-apps/assist/wrangler.jsonc
- Modify: customer-apps/assist/scripts/check-security-isolation.mjs
- Create: customer-apps/assist/scripts/context-cache.test.mjs
- Modify: customer-apps/assist/package.json

**Interfaces:**
- Produces: contextCacheKey(input: CacheIdentity) -> string
- Produces: readContextSnapshot(kv: KVNamespace, key: string, sourceVersion: string) -> Promise<string | null>
- Produces: writeContextSnapshot(kv: KVNamespace, input: CacheWrite) -> Promise<void>
- CacheWrite has customerId, assistantId, optional conversationId, sourceVersion, kind, value, and ttlSeconds.

- [ ] **Step 1: Add failing tests** named testCacheKeysAreTenantAndAssistantScoped, testSnapshotRequiresMatchingSourceVersion, testSnapshotExpiresAtConfiguredTtl, and testKvFailureReturnsCacheMiss.
- [ ] **Step 2: Run the focused test** with node --experimental-strip-types --test scripts/context-cache.test.mjs. Expected: the new cache tests fail.
- [ ] **Step 3: Implement the cache adapter** and add a CONTEXT_CACHE KV binding to the Assist Worker. Treat KV exceptions and misses as cache misses; never convert them into authorization or billing success.
- [ ] **Step 4: Run the focused test.** Expected: all cache tests pass, including version mismatch and tenant separation.
- [ ] **Step 5: Commit** with message feat(assist): add versioned context cache.

### Task 2: Cache and invalidate non-authoritative context snapshots

**Files:**
- Modify: customer-apps/assist/src/runtime.ts
- Modify: customer-apps/assist/src/index.ts
- Modify: customer-apps/assist/src/conversation/context-cache.ts
- Modify: customer-apps/assist/scripts/conversation-context.test.mjs
- Modify: customer-apps/assist/scripts/check-production-acceptance.mjs

**Interfaces:**
- Consumes: contextCacheKey, readContextSnapshot, and writeContextSnapshot from Task 1.
- Snapshot kinds: published_prompt_tools, conversation_context, and knowledge_retrieval.
- Prompt source version is the published prompt version; knowledge source version hashes the assistant's collection links and item IDs/updated_at values; conversation source version includes the memory-clear cutoff and latest message timestamp.

- [ ] **Step 1: Add failing tests** named testPromptEditChangesCacheVersion, testMemoryClearRejectsEarlierSnapshot, testKnowledgeSnapshotRequiresCurrentCollectionVersion, and testCacheFallbackNeverSuppliesBillingOrPauseState.
- [ ] **Step 2: Run the focused tests.** Expected: the new invalidation and boundary tests fail.
- [ ] **Step 3: Integrate cache writes and version checks** into prompt publication, knowledge mutation, memory clear, and runtime context loading. Use 900-second TTL for prompt/tool snapshots and 300-second TTL for conversation/knowledge snapshots. If D1 can verify critical controls but an optional knowledge query fails, use only a fresh, matching knowledge snapshot; if critical D1 state fails, defer before inference.
- [ ] **Step 4: Run focused tests.** Expected: all invalidation tests pass; D1 remains required for every paid inference reservation and control check.
- [ ] **Step 5: Commit** with message feat(assist): cache and invalidate conversation context.

### Task 3: Durably receive and replay incoming channel messages

**Files:**
- Create: customer-apps/assist/src/queues/inbound.ts
- Modify: customer-apps/assist/src/index.ts
- Modify: customer-apps/assist/src/runtime.ts
- Modify: customer-apps/assist/wrangler.jsonc
- Modify: .github/workflows/mkety-assist-ci.yml
- Modify: .github/workflows/mkety-assist-deploy.yml
- Modify: customer-apps/assist/scripts/check-production-acceptance.mjs
- Create: customer-apps/assist/scripts/inbound-replay.test.mjs
- Modify: customer-apps/assist/package.json

**Interfaces:**
- Produces: enqueueInboundUpdate(env: AssistEnv, update: unknown) -> Promise<void>; validates and stores the provider update ID and payload before returning success.
- The inbound queue payload retains the provider event ID and enough validated assistant/channel identity to resolve the same conversation.
- D1 remains the deduplication and message-history authority once available.

- [ ] **Step 1: Add failing tests** named testWebhookAcknowledgesOnlyAfterQueueReceipt, testQueueFailureReturnsRetryableResponse, testDuplicateUpdateCreatesOneTurn, and testD1RecoveryResumesSameConversation.
- [ ] **Step 2: Run the focused test** with node --experimental-strip-types --test scripts/inbound-replay.test.mjs. Expected: the new replay tests fail.
- [ ] **Step 3: Implement the inbound queue consumer** so a webhook is acknowledged only after durable queue acceptance; return a retryable response if both durable receipt and queue acceptance fail. Deduplicate provider event IDs in D1 after recovery, then resume the existing reply-job path with the same conversation identity.
- [ ] **Step 4: Configure CI and deployment** to provision the queue and KV namespace, inject their IDs into the deploy-time Wrangler config, and bind their producer/consumer; run the dry-run deployment and local D1 migrations.
- [ ] **Step 5: Run focused tests.** Expected: duplicate and D1-recovery tests pass with no provider inference until credit/control state is available.
- [ ] **Step 6: Commit** with message feat(assist): durably queue inbound conversation turns.

### Verification for this plan

- Run from customer-apps/assist: npm run type-check
- Run from customer-apps/assist: node --experimental-strip-types --test scripts/context-cache.test.mjs scripts/inbound-replay.test.mjs
- Run from customer-apps/assist: npm run check:all
- Run the Assist Wrangler dry-run from the CI workflow with a placeholder D1 ID.
- Expected: no cross-customer cache access, no dropped queued turn, and no model call when D1 cannot verify paid inference.


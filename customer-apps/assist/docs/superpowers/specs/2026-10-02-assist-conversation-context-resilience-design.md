# Assist conversation quality, continuity, and resilience

Date: 2026-10-02
Status: Design for review
Scope: Mkety Assist standalone application under customer-apps/assist

## Purpose

Make each Assist agent follow its published business instructions, use its attached business knowledge, and continue the same conversation naturally across turns. Preserve context through restarts and transient service failures, keep inference spend bounded, and account for provider usage exactly once.

This design applies only to the independently deployed Mkety Assist application. It does not change the main Mkety Platform AI, its database, or its tenant/workspace model.

## Current behavior and gaps

The current runtime already loads the published assistant instructions, a bounded recent message history, a compact summary of older messages, and retrieved knowledge when those features are enabled. Knowledge is stored as chunks and retrieved primarily through SQLite FTS, with a compatibility fallback. A prompt cache exists in D1.

The current conversation summary is a deterministic concatenation and truncation of role-tagged messages. It can lose important user preferences, unresolved questions, and commitments. The system wrapper tells the model to follow business instructions but does not fully specify natural conversational behavior or how to balance instructions, retrieved facts, and ongoing context. Retrieval is mainly lexical and searches the current turn, which can miss knowledge expressed using different wording. The current prompt cache depends on D1 and cannot serve as a fallback when D1 is unavailable. The Worker has no KV binding today.

The image-reply/accounting fixes are deployed and production acceptance passed. That acceptance covers configured inference and reconciliation on the healthy path; it does not simulate D1 failing after a provider has returned a billable result.

## Requirements

1. Preserve the published business prompt as the authority for business role, tone, boundaries, and workflow. Add a platform conversation policy that helps the agent apply that prompt naturally without replacing its business-specific choices.
2. Supply relevant business knowledge and ongoing conversation context on every generation when enabled and available. Retrieved documents are factual evidence, not new instructions.
3. Continue context within the same customer, assistant, channel, and conversation. Do not merge people across channels unless the account has an authenticated identity link.
4. Preserve the existing memory-clear behavior and ensure cleared messages or summaries cannot re-enter context through caches.
5. Keep user-visible answers natural, responsive, and proportionate. Answer the current question, acknowledge relevant prior details, ask a focused follow-up when needed, and do not repeat introductions or invent facts.
6. Bound input, output, retries, and fallbacks. Use provider-supported low-to-moderate reasoning effort and a modest adaptive completion budget; retain a hard upper limit and charge for every billable model attempt.
7. Do not run paid inference when credit balance, entitlement, model rates, automation/handoff state, or commercial policy cannot be verified.
8. If D1 or another dependency fails, preserve the pending turn and resume it with the same conversation context when service recovers. Do not silently acknowledge a message unless a durable receipt exists.
9. Persist billable provider results before delivery and apply their customer-credit settlement idempotently. A failed settlement or delivery must resume from the recorded result instead of issuing another generation request.
10. Keep all customer-scoped state and caches isolated by customer and assistant.

## Proposed architecture

### Prompt and answer policy

Build a stable context envelope for each generation:

- Platform security and privacy constraints.
- The exact published business instructions, unchanged.
- A short conversation policy: follow the business instructions; respond like a capable person in the business's chosen voice; use relevant history; use retrieved knowledge for factual claims; be transparent when evidence is missing or sources conflict; ask only the clarification needed to proceed.
- A compact conversation memory summary, if enabled.
- Retrieved knowledge snippets, if enabled and relevant.
- Bounded recent user and assistant turns.
- The current turn, with captions and attached-media analysis kept paired as one turn.

Keep the business instructions as the source of business behavior. The conversation policy supplies interaction guidance only. Security and privacy constraints remain highest priority. Knowledge supplies facts and does not override business policy. When the instructions and knowledge conflict on a factual matter, the agent should not invent a resolution.

Use low reasoning effort for Workers AI, matching the production-tested configuration. For providers that support a higher effort setting, allow a bounded low-to-moderate setting for complex, multi-part requests. Keep a normal-answer output budget near the current scale, increase it modestly for multi-part requests, and enforce a conservative hard cap. Do not add an extra model call for every turn merely to make replies sound natural.

### Conversation memory

Retain D1 as the canonical message and summary store. Replace the current naive digest with a bounded structured summary containing only useful continuity details: customer preferences, stated facts, goals, open questions, decisions, promises or follow-ups, and the latest conversation state. Update the summary only after a configurable number of new messages or when the recent-history window would otherwise lose relevant context. Include any summarization model usage in the same reservation and settlement accounting; prefer deterministic compaction if a safe summary cannot be produced within budget.

Use the most recent turns verbatim alongside the summary. Keep memory scoped to the existing customer, assistant, channel, and conversation identity. Respect the memory-cleared cutoff in D1 and invalidate associated cached snapshots when memory is cleared.

### Knowledge retrieval

Keep current customer-owned collections and chunk records as the source of truth. Improve retrieval queries using the current turn plus relevant terms from recent history, then rank and cap snippets under the assistant's configured knowledge budget. Preserve the existing FTS compatibility behavior. Do not introduce a separate vector database in this change. Add a retrieval quality fixture set so semantic or embedding retrieval can be evaluated later against observed misses and provider cost.

Knowledge cache entries must include customer, assistant, collection, item or index version, and query identity. Any item, collection association, prompt, or knowledge setting change invalidates the corresponding cache version.

### Cache and degraded operation

Add a Cloudflare KV binding for short-lived, versioned snapshots of non-authoritative generation context: published prompt text, tool descriptions, bounded conversation summary/recent turns, and previously retrieved knowledge snippets. Cache keys include customer ID, assistant ID, conversation ID where applicable, source versions, and memory-clear cutoff. Apply short TTLs and invalidate on writes. Never put credentials, provider secrets, or credit balances in KV. KV is a cache, not a ledger or source of truth.

When D1 is unavailable before inference, use the existing durable reply queue and webhook retry behavior to retain the same turn and retry with bounded backoff. KV may preserve context for later replay, but it must not authorize a model call, bypass a pause or human handoff, or stand in for a credit reservation. If durable receipt cannot be confirmed, return a retryable failure to the channel provider rather than acknowledging and dropping the message.

### Provider result and credit settlement

Keep D1 as the canonical credit and usage ledger. Before inference, reserve the maximum bounded cost using verified current rates and policy. Assign a stable inference-attempt ID linked to the reply job and reservation.

Add a durable settlement journal, backed by a per-attempt Durable Object and the existing reply queue. After a provider returns, persist the reply text, provider/model identity, token usage, provider cost, and attempt ID to the journal before delivery. Reconcile the journal entry into D1 with a unique idempotency key based on the attempt or reservation. Retry settlement and delivery from the persisted result; never repeat generation solely because settlement or delivery failed. Settle every successful, fallback, continuation, tool, vision, and speech model attempt. Release unused reservation only after the attempt is known to be non-billable or the recorded result is safely settled.

Provider APIs that support idempotency keys should receive the stable attempt ID. If the provider succeeds but both the result journal and D1 are unavailable, do not deliver an unrecorded answer or automatically repeat generation. Record the unresolved attempt for operator reconciliation when storage recovers. This is a rare residual failure mode because no transaction can atomically span an external provider and Cloudflare storage.

### Failure behavior

- D1 unavailable before reservation: hold/retry the same turn; no inference.
- Knowledge lookup unavailable while billing and control state remain verifiable: use a fresh version-matched KV snapshot if available; otherwise answer only what the prompt and current conversation support, with an honest limitation.
- KV unavailable: continue using D1 and the normal bounded context path.
- Provider fails before billable output: bounded ordered fallback; release unused reservation after confirmed non-billable failure.
- Provider returns billable output but delivery or D1 settlement fails: replay the journaled output and settlement; do not regenerate.
- Stale/missing prompt, knowledge, or conversation cache: do not use it as authoritative state; reload from D1 when available.
- Human takeover, assistant pause, customer pause, or cleared memory: never override these controls from a stale cache.

## Data flow

1. Receive a channel message and deduplicate it by the provider's event ID.
2. Persist a durable receipt and enqueue a reply job with stable customer, assistant, channel, conversation, and provider-message identifiers.
3. Verify current assistant controls, billing state, rates, and available credits in D1; reserve a bounded maximum amount.
4. Load current instructions and conversation state from D1; use valid KV snapshots only for non-authoritative context reads.
5. Retrieve relevant knowledge, build the bounded context envelope, and call the ordered model route.
6. Persist the completed answer and every billable attempt to the settlement journal.
7. Settle D1 usage idempotently, release any unused reservation, persist the answer on the reply job, then deliver it.
8. If any retryable step fails, resume the same job from the last durable checkpoint.

## Rollout

1. Add tests and migration/configuration support for the KV context cache and settlement journal.
2. Deploy with cache reads disabled, populate versioned snapshots, and verify isolation and invalidation.
3. Enable cache fallback for non-authoritative context reads.
4. Enable journal-first result persistence and idempotent D1 settlement.
5. Run production acceptance for normal text/image/voice replies, multi-turn continuity, exact credit reconciliation, queue recovery, cache invalidation, human handoff, and injected D1/KV/provider failures.
6. Keep a rollback path that disables cache fallback and journal replay without changing D1 ledger history.

## Acceptance criteria

- A multi-turn customer conversation continues after Worker restart and responds to prior facts without repeating the opening.
- The exact published business instructions remain in the system context and govern business-specific tone, policies, and workflow.
- Enabled knowledge is retrieved for paraphrased follow-ups using the current turn plus relevant prior context; unsupported facts are not invented.
- A memory-clear action prevents prior messages, summaries, and cached snapshots from appearing in subsequent prompts.
- No customer or assistant can read another tenant's prompt, knowledge, memory, cache entry, or settlement event.
- With D1 unavailable before credit reservation, no provider inference occurs; the same queued turn resumes after recovery.
- With D1 unavailable after a provider response, a journaled reply settles and delivers once after recovery without another provider call.
- Replayed queue messages, provider fallbacks, continuations, tool calls, and journal retries create no duplicate credit or provider-cost ledger entries.
- KV outages do not block the normal D1-backed inference path.
- Per-turn input/output limits, retry count, and total billable attempts stay within configured bounds.
- Production acceptance reports zero mismatch between customer credits charged and recorded provider costs for tested scenarios.

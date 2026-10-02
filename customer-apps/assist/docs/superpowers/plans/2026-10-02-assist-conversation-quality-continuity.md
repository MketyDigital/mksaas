# Assist Conversation Quality and Continuity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Make Assist answer in a natural, context-aware way while following the exact published business instructions and using relevant conversation history and knowledge.

**Architecture:** Extract prompt/context assembly into a small, testable module. Keep D1 as the source for messages, published instructions, and knowledge; improve bounded memory summaries and retrieval queries without introducing a vector database. Use provider-supported bounded reasoning and output budgets, and account for any periodic summary generation as model usage.

**Tech Stack:** TypeScript, Cloudflare Workers, D1, Node 22 built-in test runner, Wrangler.

**Spec:** customer-apps/assist/docs/superpowers/specs/2026-10-02-assist-conversation-context-resilience-design.md

## Global Constraints

- Scope is the independently deployed Mkety Assist application under customer-apps/assist.
- Keep the exact published business instructions unchanged in the generation context.
- Keep recent messages verbatim and scope continuity to customer, assistant, channel, and conversation.
- Use low reasoning effort for Workers AI; use low ordinarily and moderate only for complex requests on providers that support it.
- Use a 1,536-token normal completion budget and a 2,048-token multi-part budget as the hard cap.
- Refresh summaries only as archived context approaches the recent-history window (12 messages by default) or after 12 new messages.
- Do not add a separate vector database or a summary model call on every turn.
- Charge all billable reply, fallback, continuation, tool, and summary attempts.

## Review Focus

- Retrieved document text that looks like instructions must remain factual evidence; Task 1 tests that the business prompt remains authoritative.
- Captions and media analysis must stay paired to their original turn; Task 1 tests mixed text and image context.
- A short follow-up such as “what about the price?” must retain the referenced subject; Task 3 tests query construction from recent history.
- A long conversation must retain preferences, open questions, and promised follow-ups; Task 2 tests structured compaction.
- A multi-part request must receive enough output room without exceeding the hard cap; Task 4 tests both budgets.

---

### Task 1: Assemble a natural, business-faithful context envelope

**Files:**
- Create: customer-apps/assist/src/conversation/context.ts
- Modify: customer-apps/assist/src/runtime.ts
- Create: customer-apps/assist/scripts/conversation-context.test.mjs
- Modify: customer-apps/assist/package.json

**Interfaces:**
- Produces: assembleAssistantContext(input: AssistantContextInput) -> { system: string; history: ConversationTurn[]; userContent: string }
- AssistantContextInput contains businessInstructions, memory, knowledge snippets, tools, recent turns, and the current text/media turn.
- The user-facing channel sender continues to receive only the final reply text; internal context and retrieved documents are never sent as messages.

- [ ] **Step 1: Add failing tests** named testBusinessInstructionsRemainExactAndAuthoritative, testNaturalReplyPolicyUsesBusinessVoice, and testCaptionAndMediaRemainOneTurn. Assert the exact business prompt is present unchanged; retrieved knowledge is marked as evidence; prior history is preserved in order; current caption and image analysis appear in one user turn.
- [ ] **Step 2: Run the focused test** with node --experimental-strip-types --test scripts/conversation-context.test.mjs. Expected: the new tests fail because the assembler is not implemented.
- [ ] **Step 3: Implement assembleAssistantContext** in src/conversation/context.ts and replace inline prompt concatenation in src/runtime.ts. Place platform security rules first, then unchanged business instructions, the short natural-conversation policy, memory, knowledge, and tools. Do not rewrite or summarize the published prompt.
- [ ] **Step 4: Run the focused test.** Expected: all three named tests pass.
- [ ] **Step 5: Commit** with message feat(assist): assemble business-faithful conversation context.

### Task 2: Preserve useful facts in bounded conversation memory

**Files:**
- Create: customer-apps/assist/src/conversation/memory.ts
- Modify: customer-apps/assist/src/runtime.ts
- Modify: customer-apps/assist/scripts/conversation-context.test.mjs

**Interfaces:**
- Produces: summarizeArchivedMessages(input: MemorySummaryInput) -> Promise<{ summary: ConversationMemory; usage: ModelUsage[] }>
- ConversationMemory stores preferences, known facts, goals, open questions, decisions, commitments, and latest state.
- Consumes: D1 message history and the memory-clear cutoff; uses an injected summarizer so the logic is testable without provider calls.

- [ ] **Step 1: Add failing tests** named testSummaryKeepsPreferencesQuestionsAndCommitments, testMemoryClearExcludesOlderMessages, and testSummaryRefreshThreshold. Assert the structured fields survive compaction, cleared messages are excluded, and refresh occurs only at the spec's threshold.
- [ ] **Step 2: Run the focused test.** Expected: the new memory tests fail.
- [ ] **Step 3: Implement summarizeArchivedMessages** with the existing bounded D1 history. Permit at most one refresh per 12 newly archived messages or when the configured recent window would lose relevant context. Cap summary output at 256 tokens; include summary input/output in the same reservation and usage settlement. If the summarizer fails or lacks reserved budget, use deterministic compaction without an additional provider call.
- [ ] **Step 4: Run the focused test.** Expected: all memory tests pass and verify the memory-clear cutoff.
- [ ] **Step 5: Commit** with message feat(assist): retain structured conversation memory.

### Task 3: Retrieve knowledge using the current turn and recent references

**Files:**
- Modify: customer-apps/assist/src/runtime.ts
- Modify: customer-apps/assist/scripts/conversation-context.test.mjs

**Interfaces:**
- Produces: buildKnowledgeQuery(currentTurn: string, recentTurns: ConversationTurn[]) -> string
- Retrieval remains customer- and assistant-scoped and returns snippets under the configured character budget.

- [ ] **Step 1: Add failing tests** named testFollowUpQueryIncludesRecentSubject, testKnowledgeRetrievalStaysTenantScoped, and testKnowledgeSnippetsRespectBudget. Use a fixture where the current question is a pronoun-only follow-up and the prior turn identifies the subject.
- [ ] **Step 2: Run the focused test.** Expected: the new retrieval tests fail against current-turn-only query construction.
- [ ] **Step 3: Implement buildKnowledgeQuery** and pass a bounded set of relevant recent customer turns to existing FTS retrieval. Preserve its compatibility fallback, tenant filters, and configured knowledge budget. Do not add vector storage in this task.
- [ ] **Step 4: Run the focused test.** Expected: follow-up retrieval finds the matching fixture without exposing another assistant's chunks.
- [ ] **Step 5: Commit** with message feat(assist): ground follow-up answers in business knowledge.

### Task 4: Set bounded reasoning and reply budgets

**Files:**
- Modify: customer-apps/assist/src/runtime.ts
- Modify: customer-apps/assist/scripts/conversation-context.test.mjs

**Interfaces:**
- Produces: selectCompletionBudget(input: { userText: string }) -> 1536 | 2048
- A request is multi-part when it contains two or more questions or a numbered list with two or more requested items.

- [ ] **Step 1: Add failing tests** named testNormalReplyUses1536TokenBudget, testMultipartReplyUses2048TokenBudget, and testBudgetNeverExceeds2048.
- [ ] **Step 2: Run the focused test.** Expected: the new budget tests fail.
- [ ] **Step 3: Implement selectCompletionBudget** and pass the selected maximum through every provider adapter and continuation call. Keep Workers AI reasoning effort low; use moderate effort only for multi-part requests on providers that support it.
- [ ] **Step 4: Run the focused test.** Expected: both budgets are selected correctly and no route exceeds the cap.
- [ ] **Step 5: Commit** with message feat(assist): bound conversational reasoning budgets.

### Verification for this plan

- Run from customer-apps/assist: npm run type-check
- Run from customer-apps/assist: node --experimental-strip-types --test scripts/conversation-context.test.mjs
- Run from customer-apps/assist: npm run check:all
- Expected: each command exits zero; production acceptance contracts include the new context and provider-budget assertions.

# Mkety Public AI Design

> **Status:** Approved design for implementation
> **Date:** 2026-09-08
> **Authority:** `AGENTS.md` remains the master architectural source of truth. This design implements the Public Mkety AI described there without changing Platform AI/Agent Builder architecture.

## 1. Goal

Build the Mkety.com public support assistant as one coherent **Mkety AI** experience for visitors while keeping its runtime, memory, knowledge, credentials, tools, policies, data and provider configuration completely isolated from Mkety Platform AI and tenant agents.

The visitor sees one assistant and never selects a model or provider. Internally, the public assistant uses a provider-agnostic gateway with configurable adapters and controlled fallback.

## 2. Product Boundary

### Public Mkety AI

Location: `mkety.com`

Purpose:
- answer questions about Mkety;
- explain Mkety Platform, Academy, Enterprise and Solutions;
- explain public plans, pricing concepts and product boundaries;
- explain how and where to perform public/user onboarding tasks;
- find and summarize public Mkety documentation;
- guide visitors to the correct Mkety page or next step;
- retain support conversation context across visits on the same browser.

The public assistant is informational/support-oriented. It is not the Platform Agent Builder.

### Platform AI

Location: `app.mkety.com`

Platform AI continues to own tenant/project agents, model selection, tenant knowledge, tenant tools, agent runs, versions, publishing and other authenticated AI-building capabilities.

### Hard isolation rule

Public Mkety AI must never silently inherit or import:
- tenant agent memory;
- tenant/project knowledge;
- tenant tools or integrations;
- tenant billing/usage state;
- authenticated Platform conversation history;
- tenant/provider credentials;
- private user files;
- organization/project data;
- Platform Agent Builder permissions.

Shared low-level utilities are allowed only when they are stateless and do not weaken this boundary.

## 3. Architecture

```text
Visitor on mkety.com
        |
        v
Public Mkety AI UI
        |
        v
POST /api/public/assistant
        |
        v
Public AI Gateway
   |       |        |        |        |
   |       |        |        |        +--> Public memory service
   |       |        |        +-----------> Public support tools
   |       |        +--------------------> Public knowledge retrieval
   |       +-----------------------------> Public policy/rate limits
   +-------------------------------------> Provider router
                                             |
                                             +--> OpenAI adapter
                                             +--> Azure OpenAI adapter
                                             +--> Gemini adapter
                                             +--> Vertex AI adapter
                                             +--> Cloudflare Workers AI adapter
                                             +--> AWS Bedrock adapter
```

There is one public gateway contract and one frontend product experience. Provider adapters are infrastructure details and are not exposed to visitors.

## 4. Provider Abstraction

### Public provider contract

All providers implement the same public-only interface, conceptually:

```ts
export interface PublicAIProviderAdapter {
  id: PublicAIProviderId;
  generate(request: PublicAIProviderRequest): Promise<PublicAIProviderResponse>;
}
```

Supported provider IDs for the architecture:
- `openai`
- `azure-openai`
- `gemini`
- `vertex`
- `cloudflare-ai`
- `bedrock`

Adapters must live inside the public-assistant feature boundary. They must not reuse the tenant `getAIProvider()` path as their runtime entry point.

### Configuration

The public gateway reads public-specific configuration such as:
- `MKETY_PUBLIC_AI_ENABLED`
- `MKETY_PUBLIC_AI_PRIMARY_PROVIDER`
- `MKETY_PUBLIC_AI_FALLBACK_PROVIDERS`
- `MKETY_PUBLIC_AI_MODEL`
- provider-specific public credentials/configuration.

The frontend never receives provider secrets, model credentials, provider routing order or raw provider errors.

### Routing behavior

1. Resolve the configured primary provider.
2. Reject requests before provider execution if public safety/rate/input checks fail.
3. Execute the primary provider with a bounded timeout.
4. On retryable provider failure, try configured fallback providers in order.
5. Stop after the bounded fallback chain.
6. Return a safe Mkety-branded unavailable response if every configured provider fails.

No dynamic autonomous provider marketplace/ranking system is required for launch. Selection remains explicit and operationally configurable.

## 5. Public Knowledge

Public Mkety AI must know Mkety through an approved public knowledge boundary.

Allowed sources:
- published Mkety CMS pages;
- published docs categories/articles;
- published navigation and product content;
- published pricing/plan content;
- code-owned public product facts that reflect `AGENTS.md`;
- explicitly approved public help material.

Disallowed sources:
- unpublished CMS drafts;
- admin-only revisions;
- tenant/project data;
- private user files;
- private billing records;
- secrets/config values;
- unrelated tables in the connected Supabase project.

### Retrieval

Launch retrieval should prefer existing Mkety CMS/docs data and database capabilities. Do not introduce a new vector database merely to claim RAG. Retrieval may begin with bounded structured/full-text lookup over approved public content and evolve to embeddings/vector search when concrete scale or quality requires it.

The assistant should answer from retrieved public facts whenever the question is about current Mkety products, docs, pricing or navigation. If information is unavailable, it should say so rather than inventing a capability or entitlement.

## 6. Day-One Public Tools

Public Mkety AI has tools from day one, but only informational/support tools.

Approved initial tool categories:

### `search_public_docs`
Search published Mkety documentation and return relevant articles/sections.

### `search_public_site`
Search approved public pages/CMS content for current product and company information.

### `get_public_pricing`
Retrieve current published plans/pricing/feature presentation without inventing unavailable entitlements.

### `resolve_public_route`
Return the correct canonical public Mkety route for a requested destination or task.

### `get_public_product_summary`
Return a bounded summary for Platform, Workspaces, SolutionHub, Academy, Enterprise, Trading-as-Custom/Enterprise and other approved public categories.

These are read-only support tools. They may query only public-approved Mkety content.

Explicitly excluded from the public assistant at this stage:
- account mutation;
- payments;
- subscription changes;
- deployment creation;
- workflow execution;
- tenant agent execution;
- user/project lookup;
- admin operations;
- arbitrary HTTP requests;
- arbitrary connector execution.

A public tool registry must be allow-list based. The model cannot dynamically request unregistered internal functions.

## 7. Day-One Memory

The public assistant remembers visitors across future visits on the same browser.

### Identity

Use a random opaque anonymous visitor ID stored in a secure browser cookie. The identifier must not encode email, IP address, account ID, tenant ID or other personal data.

Cookie properties:
- `HttpOnly` where server ownership permits;
- `Secure` in production;
- `SameSite=Lax` or stricter;
- scoped to the public Mkety site as narrowly as practical;
- signed or otherwise integrity-protected so clients cannot impersonate another visitor by editing the value.

### Public memory store

Create public-assistant-owned persistence separate from tenant agent memory. Suggested logical entities:

```text
public_ai_visitors
public_ai_conversations
public_ai_messages
public_ai_memory_facts
public_ai_tool_runs
```

Exact schema naming may follow existing repo conventions, but tables must be clearly public-assistant scoped and owned by `mksaas`.

### Conversation memory

The assistant restores recent conversation history for the anonymous visitor and can continue prior support conversations across browser visits.

The UI provides:
- reopen/recent conversation behavior;
- `New chat`;
- a way to clear/delete public AI history for the browser identity.

### Long-term support memory

`public_ai_memory_facts` may contain only bounded support-relevant facts derived from the visitor's own public-assistant conversation, for example:
- interests such as Academy vs Platform;
- the product/workspace they were asking about;
- onboarding stage;
- previously requested public guidance.

Do not extract or retain secrets, passwords, payment details, authentication tokens or private tenant data as memory facts.

Memory extraction must be conservative and policy-controlled. Conversation history remains the primary source of continuity; long-term facts are supplemental.

### Retention

Retention must be bounded and configurable. Do not claim a fixed public retention period in marketing/legal copy until the actual configured policy is approved. Implementation must support expiry/deletion rather than permanent anonymous storage.

## 8. One Mkety AI, Isolated Capability Domains

Mkety may have multiple AI experiences while maintaining one product identity.

```text
Mkety AI
  |
  +-- Public Support Runtime (mkety.com)
  |      +-- public memory
  |      +-- public knowledge
  |      +-- public support tools
  |      +-- public providers
  |
  +-- Platform AI Runtime (app.mkety.com)
         +-- tenant/project memory
         +-- tenant knowledge
         +-- tenant tools
         +-- tenant/model configuration
         +-- agent builder/runs/publishing
```

The commonality is product philosophy and optional stateless primitives. The isolation boundary is data, credentials, policies, tools, authorization, memory and runtime configuration.

This avoids creating two conflicting Mkety brands while preventing the dangerous alternative of making the anonymous website assistant a tenant agent.

## 9. Request Lifecycle

1. Visitor opens Mkety AI.
2. Server obtains/creates the protected anonymous visitor ID.
3. UI loads the visitor's recent public conversation.
4. Visitor submits a message.
5. API validates input size, message count and request shape.
6. Public rate limiter checks anonymous visitor plus edge/request characteristics.
7. Gateway loads bounded public conversation context.
8. Gateway retrieves relevant published Mkety knowledge.
9. Gateway supplies only approved public tools.
10. Provider router invokes the configured primary adapter.
11. If the model requests a support tool, the gateway validates the exact tool against the public allow-list and executes it server-side.
12. Provider produces an answer grounded in public Mkety context/tool output.
13. Gateway persists visitor message, assistant response, safe tool metadata and provider-neutral observability fields.
14. UI receives the answer without provider credentials or internal errors.
15. Background-like asynchronous behavior is not required for user-visible completion; the request must complete or return a safe failure in the active interaction.

## 10. System Behavior

Public Mkety AI should behave as a knowledgeable Mkety website support agent.

It should:
- know Mkety's product hierarchy;
- understand that Mkety is broader than AI;
- distinguish Platform, Academy and Enterprise;
- distinguish Workspaces from SolutionHub;
- present Trading as Custom/Enterprise where applicable;
- explain where users should go and how to perform documented tasks;
- use concise, helpful navigation guidance;
- provide canonical Mkety routes when useful;
- answer from public docs/content rather than speculation;
- clearly state uncertainty when public information is missing.

It must not:
- claim access to a visitor's Platform account unless such access is deliberately added later with explicit authentication/authorization;
- expose or infer private tenant data;
- invent pricing, certifications, SLAs or product capabilities;
- execute arbitrary actions;
- pretend to have completed an operation it cannot perform.

## 11. API Boundary

Primary endpoint:

```text
POST /api/public/assistant
```

Supporting public endpoints may be added for conversation history/new-chat/delete-history if separation improves clarity, for example:

```text
GET    /api/public/assistant/conversations
POST   /api/public/assistant/conversations
DELETE /api/public/assistant/conversations/:id
```

All endpoints use the anonymous public visitor identity, never tenant authorization as an implicit fallback.

Input and output contracts must be schema validated.

## 12. Security and Abuse Controls

Required from launch:
- strict request schema validation;
- message/input size bounds;
- bounded history context;
- bounded output tokens;
- per-visitor rate limiting;
- edge/IP-derived abuse signal where available, without treating IP as durable identity;
- provider timeout;
- bounded fallback attempts;
- tool allow-list;
- tool argument schema validation;
- public-only database queries;
- prompt-injection resistance through tool/data boundary enforcement;
- secret isolation;
- safe logging/redaction;
- no raw provider error response to visitors;
- CSRF/origin protections where applicable;
- audit/observability fields for tool/provider failures;
- deletion path for public memory.

Prompt text alone is not considered a security boundary. Authorization and data isolation must be enforced in code and database query scope.

## 13. Observability

Record provider-neutral operational metadata such as:
- request ID;
- conversation ID;
- provider adapter ID;
- model identifier in server-side telemetry;
- latency;
- fallback count;
- tool names invoked;
- success/failure category;
- token/usage metadata when provider supplies it;
- timestamps.

Do not log provider credentials, cookies, raw authorization headers or unnecessary private message contents.

The UI should not show provider/model routing details unless Mkety deliberately changes product policy later.

## 14. Frontend Experience

The public site has one branded Mkety AI experience.

Recommended interaction:
- compact launcher integrated into the public Mkety shell;
- opens a polished chat panel/drawer appropriate to the existing mksaas design language;
- welcome copy explaining it can answer questions about Mkety;
- suggested prompts such as:
  - `What can I build with Mkety?`
  - `Which Mkety product is right for me?`
  - `How does Automation work?`
  - `Explain SolutionHub.`
  - `How do I get started?`
- conversation continuity across visits;
- `New chat` control;
- history/clear-history control;
- loading, retry and safe unavailable states;
- responsive and keyboard-accessible behavior.

No provider selector and no model selector appear in this public UI.

## 15. Database Boundary

Development uses the connected `Mkety Digital` Supabase PostgreSQL instance only for repository-owned `mksaas` schema/tables. Public AI migrations must modify only Mkety-owned objects and must never reset or alter unrelated Supabase projects/tables.

Production architecture remains Cloudflare + OCI according to `AGENTS.md`; using Supabase for development does not redefine the production identity or authentication architecture.

Public AI persistence must not introduce Supabase Auth. ZITADEL + Mkety auth remains the Platform authority, while the anonymous public assistant uses its own opaque browser visitor identity.

## 16. Candidate and Production Gates

Public Mkety AI is part of the mkety.com launch gate, not a deferred follow-up.

The isolated Cloudflare candidate must prove:
- public AI configuration is present;
- at least one real provider adapter is healthy;
- `/api/public/assistant` returns a grounded Mkety response;
- public memory persists across two requests using the same anonymous visitor identity;
- `New chat` creates a separate conversation;
- a public support tool can execute successfully;
- tenant/private data paths are not required for the public request;
- provider failure returns a safe response or configured fallback succeeds;
- no provider secret is emitted in HTML/API output/log evidence;
- all existing public route, DB, lint, test, typecheck and vinext gates continue to pass.

Production cutover to `mkety.com` occurs only after the public-site and Public Mkety AI candidate acceptance gates are green.

## 17. Initial Provider Delivery Strategy

The architecture supports OpenAI, Azure OpenAI, Gemini, Vertex AI, Cloudflare Workers AI and AWS Bedrock behind one contract.

Implementation should not block the public launch on obtaining credentials for every provider simultaneously. Build the common gateway and adapter contract first, then make adapters operational when their required credentials/configuration are available. Candidate acceptance requires at least one configured real provider and verifies configured fallback behavior when more than one provider is available.

This preserves the multi-provider architecture without weakening the launch by pretending unconfigured providers are live.

## 18. Testing Requirements

Use TDD for the implementation.

Minimum automated coverage:
- provider configuration parsing;
- provider adapter selection;
- fallback order and retryable/non-retryable failure behavior;
- public/tenant import-boundary tests where practical;
- visitor cookie creation/integrity behavior;
- conversation persistence and isolation between two anonymous visitors;
- new-chat behavior;
- delete/clear-history behavior;
- public knowledge retrieval excludes drafts/private sources;
- public tool registry rejects unknown tools;
- each support tool validates arguments and returns bounded output;
- request/message/output limits;
- rate-limit behavior;
- safe provider errors;
- prompt injection cannot cause arbitrary tool execution or tenant lookup;
- UI accessibility-critical controls;
- real candidate smoke using the connected public database and configured provider.

## 19. Non-Goals for This Public-AI Launch

The following are not required to satisfy this design:
- exposing provider/model choice to website visitors;
- turning the public assistant into Agent Builder;
- arbitrary third-party connectors;
- authenticated tenant operations;
- autonomous web browsing;
- a new standalone vector database;
- merging anonymous public memory into tenant agent memory;
- automatic AI-driven provider cost optimization across every provider.

These can be designed later if they become real product requirements.

## 20. Acceptance Definition

Public Mkety AI is complete for launch when a visitor can open mkety.com, ask Mkety questions, receive accurate grounded support answers, use informational public-support capabilities, leave and return in the same browser with conversation continuity, start a new chat or clear history, and experience the same single Mkety AI product regardless of which configured provider serves the request—while Platform AI, tenant data, tenant memory, tenant tools and tenant credentials remain technically isolated.

# Mkety Public AI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the mkety.com public support assistant with cross-visit anonymous memory, public-only knowledge/tools, a single provider-agnostic gateway, current September 2026 model validation, and Cloudflare candidate verification before production cutover.

**Architecture:** `mkety.com` exposes one Mkety AI UI and `/api/public/assistant`. A completely public-assistant-owned gateway loads only published Mkety content, public memory and allow-listed read-only support tools, then routes through interchangeable provider adapters. Public memory, tools, credentials, policies and runtime configuration never use tenant/Platform AI state.

**Tech Stack:** TypeScript, React 19, Next/vinext, AI SDK 6, Drizzle/PostgreSQL, Cloudflare Workers, Jest, Zod.

**Spec:** `docs/superpowers/specs/2026-09-08-mkety-public-ai-design.md`

## Global Constraints

- `AGENTS.md` remains immutable architectural authority.
- Public Mkety AI and Platform AI must remain conceptually and technically separate.
- Development DB changes are limited to repo-owned `mksaas` objects in the connected Mkety Digital Supabase project; never use Supabase Auth.
- Public visitors see one Mkety AI and never select provider/model.
- Public AI has day-one cross-visit same-browser memory, New chat, and delete/clear history.
- Public AI has day-one read-only support tools for published Mkety docs/site/pricing/routes/product information.
- No tenant/project memory, tenant knowledge, tenant tools, private files, authenticated Platform history, tenant billing state, tenant credentials or Platform permissions may enter the public runtime.
- Provider adapters supported by architecture: OpenAI, Azure OpenAI, Gemini API, Vertex AI, Cloudflare Workers AI, AWS Bedrock.
- September 2026 model freshness is mandatory. The registry must classify current stable/current preview-or-limited/legacy-or-rejected models and must not silently substitute a legacy model.
- Current verified reference models as of 2026-09-08: OpenAI `gpt-6-astra` (current limited rollout), `gpt-5.6-sol`, `gpt-5.6-terra`, `gpt-5.6-luna`; Gemini API `gemini-3.8-flash` stable; Vertex AI `gemini-3.8-flash`; Cloudflare Workers AI `@cf/qwen/qwen3.8-27b`; AWS Bedrock `anthropic.claude-sonnet-5` / `global.anthropic.claude-sonnet-5` and active `amazon.nova-2-lite-v1:0`; Azure OpenAI `gpt-6-astra`, `gpt-5.6-sol`, `gpt-5.6-terra`, `gpt-5.6-luna` where deployed.
- Recommended support defaults when credentials/access exist: OpenAI `gpt-5.6-terra`, Gemini/Vertex `gemini-3.8-flash`, Cloudflare `@cf/qwen/qwen3.8-27b`, Bedrock `global.anthropic.claude-sonnet-5`, Azure OpenAI `gpt-5.6-terra`. `gpt-6-astra` is registered as current but must not be assumed available until provider health/config confirms access.
- Provider/model IDs are server-side configuration and never exposed as user-selectable UI.
- Production remains Cloudflare + OCI; no Vercel deployment path.
- TDD: no production behavior is added before a failing test establishes it.

---

### Task 1: Current-model registry and public configuration

**Files:**

- Modify: `src/features/public-assistant/config.ts`
- Modify: `src/features/public-assistant/config.test.ts`
- Create: `src/features/public-assistant/models.ts`
- Create: `src/features/public-assistant/models.test.ts`
- Modify: `src/shared/lib/env.ts`

**Interfaces:**

- Produces `PublicAIProviderId`, `PublicAIModelStatus`, `PUBLIC_AI_MODEL_REGISTRY`, `getPublicAIModelDefinition()`, `assertCurrentPublicAIModel()`, and parsed public provider routing configuration.
- Provider configuration remains independent of `MKETY_AI_PROVIDER` / `MKETY_AI_MODEL`.

- [ ] Write RED tests proving all six provider IDs are accepted, September 2026 defaults resolve, legacy IDs such as `gpt-4o-mini`, `gemini-2.0-flash`, and deprecated Workers AI models are rejected for public AI, and `gpt-6-astra` can be marked current-limited rather than legacy.
- [ ] Run the focused tests and verify RED because the registry/config behavior does not exist.
- [ ] Implement the typed model registry and public-only env schema with explicit provider-specific variables.
- [ ] Run focused tests and full public-assistant tests GREEN.
- [ ] Commit `feat: add current public AI provider registry`.

### Task 2: Public AI persistence schema and anonymous visitor identity

**Files:**

- Create/modify Drizzle schema following existing repository schema conventions for `public_ai_visitors`, `public_ai_conversations`, `public_ai_messages`, `public_ai_memory_facts`, `public_ai_tool_runs`.
- Create a forward-only migration in the existing Mkety migration path.
- Create: `src/features/public-assistant/server/visitor.ts`
- Create tests beside schema/visitor modules.
- Extend Mkety DB migration/smoke scripts only for these repo-owned tables.

**Interfaces:**

- Produces protected opaque visitor identity helpers and repository functions to load/create conversations, append messages, create New chat, and delete visitor history.

- [ ] Write RED tests for different anonymous visitors being isolated, same visitor restoring history, New chat creating a separate conversation, and clear-history deleting only that visitor's public AI data.
- [ ] Verify RED.
- [ ] Implement schema, migration, cookie identity and persistence repositories; use an opaque random ID plus server integrity protection.
- [ ] Run focused persistence tests GREEN.
- [ ] Run migration/DB smoke against connected staging DB through CI before marking verified.
- [ ] Commit `feat: add isolated public AI memory`.

### Task 3: Public knowledge retrieval and support tool registry

**Files:**

- Create: `src/features/public-assistant/server/knowledge.ts`
- Create: `src/features/public-assistant/server/tools.ts`
- Create corresponding tests.
- Reuse published-query functions from `src/features/platform-content/server/*` only where they already guarantee published/public scope; otherwise add narrow public query functions there.

**Interfaces:**

- Produces `searchPublicDocs`, `searchPublicSite`, `getPublicPricing`, `resolvePublicRoute`, `getPublicProductSummary`, and `PUBLIC_SUPPORT_TOOLS` allow-list.

- [ ] Write RED tests proving drafts/admin revisions/private data are excluded, public route resolution is canonical, pricing ordering is deterministic, and unknown tools are rejected.
- [ ] Verify RED.
- [ ] Implement bounded retrieval over published Mkety CMS/docs/pricing data and allow-listed read-only tools.
- [ ] Run focused tests GREEN.
- [ ] Commit `feat: add public AI knowledge and support tools`.

### Task 4: Provider adapter contract and failover gateway

**Files:**

- Create: `src/features/public-assistant/server/providers/types.ts`
- Create adapter modules for `openai`, `azure-openai`, `gemini`, `vertex`, `cloudflare-ai`, `bedrock`.
- Create: `src/features/public-assistant/server/providers/index.ts`
- Create: `src/features/public-assistant/server/gateway.ts`
- Create tests for adapters/router/gateway.
- Add dependencies only when required by a provider and prefer standards-compatible fetch/AI SDK paths that remain Cloudflare-compatible.

**Interfaces:**

- All adapters implement `PublicAIProviderAdapter.generate(request)`.
- Gateway produces provider-neutral answer/tool/usage/failure metadata and bounded fallback.

- [ ] Write RED tests for primary selection, current-model validation before invocation, retryable fallback order, non-retryable validation failures, timeout handling, safe all-provider failure, and no import/use of tenant `getAIProvider()`.
- [ ] Verify RED.
- [ ] Implement the common adapter contract, current-model guard, six provider adapters, and bounded failover gateway.
- [ ] Keep tool execution behind the public allow-list and validate tool arguments server-side.
- [ ] Run gateway/provider tests GREEN.
- [ ] Commit `feat: add isolated multi-provider public AI gateway`.

### Task 5: Public assistant API and memory lifecycle

**Files:**

- Create: `src/app/api/public/assistant/route.ts`
- Create supporting conversation history/new/delete routes only where clearer than overloading one endpoint.
- Create request schemas and API tests.

**Interfaces:**

- `POST /api/public/assistant` accepts bounded visitor messages and returns provider-neutral Mkety AI responses.
- Supporting routes expose only the requesting anonymous visitor's public conversations.

- [ ] Write RED tests for request validation, origin/CSRF posture where applicable, rate limiting, bounded history, safe provider errors, persistence, public tool execution and visitor isolation.
- [ ] Verify RED.
- [ ] Implement API routes, request IDs, rate limiting, gateway call, persistence and safe errors.
- [ ] Run API tests GREEN.
- [ ] Commit `feat: expose Mkety public AI API`.

### Task 6: Public Mkety AI UI with cross-visit history

**Files:**

- Create focused public-assistant client components under `src/features/public-assistant/components/`.
- Modify `src/features/platform-content/components/public/MketyPublicShell.tsx` or its shared composition point.
- Create UI tests.

**Interfaces:**

- One Mkety AI launcher/panel on public pages, no provider/model selector.
- Supports recent conversation continuity, New chat, history clearing, loading/retry/unavailable states and suggested Mkety prompts.

- [ ] Write RED accessibility/behavior tests for open/close, keyboard controls, New chat, history restore, clear history and absence of provider/model selectors.
- [ ] Verify RED.
- [ ] Implement compact mksaas-DNA UI and API integration.
- [ ] Run UI tests GREEN.
- [ ] Commit `feat: add Mkety public AI experience`.

### Task 7: Candidate configuration, real-provider smoke and freshness gate

**Files:**

- Modify `.github/workflows/mkety-public-candidate-deploy.yml`
- Add/modify candidate smoke script(s) under `scripts/`.
- Update continuation documentation after verification.

**Interfaces:**

- Candidate workflow validates public AI env/secrets, applies public AI migration, deploys server Worker, exercises memory/tool/API behavior and rejects configured legacy models.

- [ ] Write/check workflow-level assertions that fail when no current configured provider is healthy, while allowing unconfigured optional adapters.
- [ ] Add candidate checks for same-cookie continuity, New chat separation, one public support tool, safe provider failure behavior and secret non-disclosure.
- [ ] Deploy candidate and verify all public routes plus Public AI.
- [ ] Record real provider/model used server-side in CI evidence without exposing credentials.
- [ ] Commit `ci: verify Mkety public AI candidate`.

### Task 8: Full acceptance and production cutover gate

**Files:**

- Modify `docs/MKETY_DEVELOPMENT_CONTINUATION.md` with verified evidence.
- Add guarded production workflow only after candidate acceptance if not already present.

**Interfaces:**

- Production cutover remains blocked until public site + AI acceptance are green.

- [ ] Run full tests, type-check, lint, vinext compatibility, build, DB smoke and candidate HTTP checks.
- [ ] Verify public UI/content/metadata/navigation, memory/tool behavior and no tenant/private path dependency.
- [ ] Inspect current Cloudflare zone/routes with read-only evidence before mutation and document rollback.
- [ ] Bind verified production Worker to `mkety.com`, preserve canonical `www` behavior, verify SSL and run external production smoke only after candidate is green.
- [ ] Update handoff and resume `app.mkety.com` stacked PR order only after mkety.com is production-verified.

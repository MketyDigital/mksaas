# Mkety Central AI Runtime Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Restore public AI and workspace AI independently on Mkety's one central provider/model setup, while preserving isolated surface policies and Assist's independent production controls.

**Architecture:** Public AI, workspace AI, and Enterprise AI resolve external provider credentials from the same platform-level provider connection and Workers AI binding. Each surface retains its own enablement, route, memory, data, entitlement, budget, and audit rules. Enterprise AI availability must not gate public or workspace inference. Assist remains a separate application and data/runtime boundary with its own controls, while the model/provider catalog is shared as a versioned contract.

**Spec:** `docs/superpowers/specs/2026-10-21-mkety-current-truth-and-app-domain-design.md`

## Global Constraints

- Never store a second Public-only copy of central provider keys or install a second Workers AI binding for Public or Workspace AI.
- Public and Workspace routes remain independently configurable and fail independently; Enterprise AI off/unconfigured cannot disable either.
- Assist keeps its production runtime, controls, customer data, and ledger isolated; share catalog definitions only.
- Accept Azure Foundry project endpoints without dropping `/api/projects/<project>` from the request URL.
- Never silently convert a failed provider call into a paid request on a different credential class.
- Admin errors must expose a safe reference that correlates with a structured server log, without exposing secrets or SQL details.
- Run focused tests first; run the full applicable suites before describing a fix as complete.

## Review Focus

- A stale model for an unused provider must not prevent selecting a valid provider/model.
- A stale active model must be repairable from the admin form without requiring a direct database edit.
- Public and workspace provider lookup must resolve the same central connection after migration.
- Foundry project paths and deployment identifiers must survive save, read, and request construction.
- Public request-scoped DB reads must not fall through to a Worker-isolate singleton client.
- Enterprise AI being disabled must not change Public or Workspace route selection.
- Admin action references must be visible to the operator and appear in matching logs.

---

### Task 1: Bind Public AI inference to the request-scoped database

**Files:**
- Modify: `src/features/public-assistant/server/request-database.ts`
- Modify: `src/features/public-assistant/server/request-database.test.ts`
- Modify: `src/shared/db/request-context.test.ts` only if a focused contract is missing

**Interfaces:**
- Consumes: `withRequestDatabase(work)` and the existing AsyncLocalStorage-backed `db` proxy.
- Produces: public API requests whose nested dynamic-config and provider-connection queries use the same short-lived PostgreSQL client as memory operations.

- [x] **Step 1: Add a failing regression test** proving the `db` proxy resolves the active request database during Public AI and that nested provider/config queries resolve the active sequential request database; shared `withRequestDatabase` owns client cleanup.
- [x] **Step 2: Replace** the custom direct PostgreSQL wrapper with the shared `withRequestDatabase` boundary.
- [x] **Step 3: Run** `pnpm exec jest src/features/public-assistant/server/request-database.test.ts --runInBand` and the related database request-context tests.

### Task 2: Use one platform-level provider connection for Public and Workspace AI

**Files:**
- Modify: `src/features/public-assistant/server/admin-actions.ts`
- Modify: `src/features/public-assistant/server/dynamic-config.ts`
- Modify: `src/features/ai-runtime/server/provider-connections.ts`
- Create: `src/shared/db/migrations/0044_public_ai_provider_connections.sql`
- Modify: `src/shared/db/migrations/meta/_journal.json`
- Create: `src/shared/db/migrations/meta/0044_snapshot.json`
- Modify: focused provider-connection and public-AI tests

**Interfaces:**
- Consumes: `ai_provider_connections` with existing `platform` and legacy `public` system modes.
- Produces: Public credential save/list/resolve/disable operations using the same `platform` row used by Workspace and centrally managed Enterprise routes; migration promotes public-only rows and removes a duplicate legacy row only when a platform row for the same provider already exists.

- [x] **Step 1: Test** shared mode selection and migration conflict behavior, including preserving a legacy Public credential when no platform row exists.
- [x] **Step 2: Add the additive, idempotent migration** to promote Public-only system connections; retain an existing platform connection when both exist.
- [x] **Step 3: Change Public provider actions and resolution** to use `mode: 'platform'`.
- [x] **Step 4: Verify** tenant/project BYOK remains scoped and never participates in Public or central Workspace resolution.
- [x] **Step 5: Run** focused AI provider tests and `pnpm db:check:migrations`.

### Task 3: Repair Azure Foundry project support and current model allow-list

**Files:**
- Modify: `src/features/public-assistant/models.ts`
- Modify: `src/features/public-assistant/models.test.ts`
- Modify: `src/features/public-assistant/components/PublicAiControlPanel.tsx`
- Modify: `src/features/ai-runtime/providers/external.ts`
- Modify: `src/features/ai-runtime/providers/external.test.ts`
- Modify: any central-model admin/catalog view proven to reject `gpt-6-luna-1`

**Interfaces:**
- Consumes: approved Azure deployment `gpt-6-luna-1` and the configured Foundry project endpoint.
- Produces: accepted current Azure model configuration and a Responses API URL that preserves the optional `/api/projects/<project>` prefix.

- [x] **Step 1: Write failing tests** for `azure-openai/gpt-6-luna-1`, Foundry project endpoint preservation, Azure resource-root backward compatibility, and safe path validation.
- [x] **Step 2: Implement** the exact allow-list entry and project-aware endpoint normalization/request construction; update admin instructions to request a full project endpoint for Foundry project deployments. Existing endpoint construction already preserved the project path; tests now lock it in.
- [x] **Step 3: Run** public model/configuration and central Azure adapter suites.

### Task 4: Make routing updates repairable and model validation route-scoped

**Files:**
- Modify: `src/features/public-assistant/server/admin-actions.ts`
- Modify: `src/features/public-assistant/server/dynamic-config.ts`
- Modify: `src/features/public-assistant/server/dynamic-config.test.ts`
- Modify: `src/features/public-assistant/server/admin-actions.test.ts`
- Modify: `src/features/public-assistant/components/PublicAiControlPanel.tsx`

**Interfaces:**
- Consumes: independently selected primary/fallback chain and per-provider model fields.
- Produces: validation of models that are active in the submitted chain, with invalid inactive legacy values normalized to the provider's current default so stale fields cannot lock the controls or disable unrelated routes.

- [x] **Step 1: Test** valid `workers-ai` selection when an inactive Azure form field contains an unsupported legacy value, and test rejection when the active model itself is unsupported.
- [x] **Step 2: Implement** route-scoped validation and safe default normalization for inactive stored models; never silently replace an invalid active selection.
- [x] **Step 3: Verify** Public AI remains independently enabled/routed when Enterprise AI configuration is absent or off by tracing the runtime boundary; Enterprise gates are not consulted.
- [x] **Step 4: Run** focused Public AI runtime/admin suites.

### Task 5: Return a visible, correlatable reference for failed Platform Control mutations

**Files:**
- Modify: `src/shared/db/platform-control-mutation.ts`
- Create: `src/shared/db/platform-control-mutation.test.ts`
- Modify: `src/app/ops/[tenant]/platform-control/[module]/page.tsx`

**Interfaces:**
- Consumes: safe server-action mutation error and Platform Control redirect query.
- Produces: a UUID reference shown in the admin error panel and emitted in the matching structured log prefix.

- [x] **Step 1: Test** that a failed action redirects with a reference, logs the same reference, and keeps database/secret details out of the URL and UI.
- [x] **Step 2: Implement** the reference generation, correlation, and rendering.
- [x] **Step 3: Run** Platform Control mutation and page tests.

### Task 6: Reconcile AI architecture docs and runtime acceptance evidence

**Files:**
- Modify: `docs/MKETY_AI_RUNTIME_GATEWAY_ARCHITECTURE.md`
- Modify: `docs/MKETY_DEVELOPMENT_CONTINUATION.md`
- Modify: `docs/CURRENT_WORKSTREAM_STATUS.md`
- Modify: `AGENTS.md` only after its protected end marker
- Add focused contract tests tying the shared provider/model contract to Assist without importing Mkety Platform runtime credentials or data code.

- [x] **Step 1: Document** shared provider/model catalog and credentials, independent Public/Workspace/Enterprise route policies, and Assist's separate controls/runtime with shared catalog definitions.
- [x] **Step 2: Add** explicit coverage that the Platform shared catalog includes the approved Azure Foundry deployment and current Workers AI pair. Public model tests cover both. Assist production source remains unchanged; do not integrate the catalog into Assist without separate authorization.
- [x] **Step 3: Run** relevant Platform AI tests, migration baseline, root type-check/build, and read-only Assist checks. Current local Platform AI suites pass (60 suites / 232 tests), root type-check and migration baseline pass, and Assist `check:all` passes. A fresh Next build stops before compilation because the `@swc/core` Linux native binding is unavailable in this checkout; Assist's type-check also cannot start because `@cloudflare/workers-types` is absent.
- [x] **Step 4: Record** the exact tested source snapshot and separate local tests from CI and production evidence. AI code-scope tree SHA: `a77cc65125f27caf65589248976c1df9f50152d2`, based on commit `4516d683b536ec3e8a072a80065d0ff6608338ee`; this local tree fingerprint covers the Platform AI runtime, Public AI, shared catalog, and Enterprise AI order schema, but is not a pushed commit or CI-attested SHA. Public AI's separate production repair passed Actions run `39988937106` and a fresh response check returned `ready`; Enterprise customer inference remains OFF and has no customer-acceptance proof on this snapshot.

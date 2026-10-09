# Assist pricing and GPT-6 Luna cutover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Standardize Assist rates and make Azure Foundry gpt-6-luna-1 the primary replacement for Sol without losing any user-visible capability available through Sol.

**Architecture:** Keep rate derivation shared between billing and operator displays, using provider base costs with explicit minimums and separate post-base multipliers. Add an evidence-based capability parity layer for Luna, then perform a guarded, targeted route migration that preserves all non-Sol fallbacks and the separate Whisper speech route.

**Tech Stack:** TypeScript, Cloudflare Workers, D1 SQL migrations, Node built-in test runner, Wrangler.

**Spec:** `customer-apps/assist/docs/superpowers/specs/2026-10-09-assist-provider-pricing-luna-cutover-design.md`

## Global Constraints

- Text minima: 2,000 MKredit per 1M input tokens and 10,000 MKredit per 1M output tokens.
- Media minima: 20 MKredit per image and 20 MKredit per voice minute.
- Base rate is `max(provider rate converted to MKredit, modality minimum)`; missing provider rates use the minimum.
- Text and media/voice multipliers apply after base rate and accept 1% through 1,000%.
- Do not use OpenAI direct API prices as Azure Foundry deployment pricing.
- Set Azure Foundry `gpt-6-luna-1` as primary on routes currently using GPT-5.6 Sol; remove Sol target references from Assist route records.
- Preserve every non-Sol fallback and its current relative order; preserve the Workers AI Whisper speech route.
- Do not modify credentials, customer balances, historical usage, or ledger entries.
- Do not cut over an alias unless parity checks show no supported Assist capability is lost.
- Run `npm run check:all`, `npm run type-check`, and `npx wrangler deploy --dry-run` from `customer-apps/assist` before release.

## Review Focus

- Azure model capability differences (tools, structured output, image payload types, limits, reasoning modes) must be tested and mapped; unsupported required behavior blocks cutover.
- Missing, stale, or malformed provider rates must never create zero customer charges or fabricated provider-cost displays.
- Usage reported in different units or formats by Luna must normalize to existing MKredit settlement semantics.
- Luna image requests must not be charged twice when image usage and image-associated token usage are both reported.
- Route migration must be atomic and tenant-safe; a partial migration must leave current routing intact.

---

### Task 1: Build a verified Sol-to-Luna capability parity inventory

**Files:**
- Create: `scripts/provider-capability-parity.test.mjs`
- Modify: `src/providers/route-readiness.ts`
- Modify: `src/providers/reasoning.ts`
- Modify: `src/providers/validation.ts`
- Modify: `src/runtime.ts`
- Modify: `src/index.ts`

**Interfaces:**
- Consume existing provider route targets, capability records, provider request/response adapters, and alias readiness checks.
- Produce a documented capability matrix in `docs/superpowers/specs/2026-10-09-assist-provider-pricing-luna-cutover-design.md` and Luna capability predicates consumed by route readiness and request construction.

- [ ] **Step 1: Add parity tests** for standard/high/maximum reasoning, image input formats, streaming, tool/function calls, structured output, context/output limits, usage fields, and failures. Assert each supported Sol behavior either maps to a tested Luna behavior or remains available through an eligible non-Sol fallback; unsupported cases must make cutover readiness false.
- [ ] **Step 2: Run `npm run test:unit -- --test-name-pattern='Sol to Luna capability parity'`** from `customer-apps/assist`; verify new tests fail because Luna-specific parity is not yet established.
- [ ] **Step 3: Verify exact Azure Foundry deployment capabilities** for `gpt-6-luna-1` using authoritative Azure docs and controlled provider calls. Record model/deployment ID, endpoint behavior, supported modalities, request parameters, output/context limits, and usage response shape. Never infer Azure support from OpenAI direct API behavior.
- [ ] **Step 4: Implement only verified mappings** in route-readiness, reasoning mapping, provider validation, request adapter, and usage normalization. Reuse existing fallback rules; never advertise unsupported features as Luna capabilities.
- [ ] **Step 5: Run the parity tests**; expect every required Sol-backed behavior to be available through Luna or a compatible non-Sol fallback, and unsupported/no-fallback cases to block readiness.
- [ ] **Step 6: Commit** as `feat(assist): establish Luna capability parity`.

### Task 2: Centralize provider-derived prices and modality floors

**Files:**
- Modify: `src/billing/provider-derived-pricing.ts`
- Modify: `src/billing/media-economics.ts`
- Modify: `src/billing/metering.ts`
- Modify: `src/runtime.ts`
- Create: `scripts/provider-derived-pricing.test.mjs`

**Interfaces:**
- Consume provider model metadata and the existing internal µUSD/MKredit conversion utilities.
- Produce shared rate derivation functions returning provider cost (or unavailable), applied minimum, source/effective date, and final customer rate for input, output, image, and voice units.

- [ ] **Step 1: Add failing unit tests** for text floors 2,000/10,000 per million, media floors 20/image and 20/minute, provider-derived rates above the floor, missing provider rate, and rounding behavior.
- [ ] **Step 2: Run `node --experimental-strip-types --test scripts/provider-derived-pricing.test.mjs`**; verify the new assertions fail against current derivation.
- [ ] **Step 3: Implement shared provider-rate derivation** in `provider-derived-pricing.ts`; retain exact existing currency conversion and unit conventions, return unknown provider cost as unavailable, and apply category multipliers only after the minimum/provider maximum is selected.
- [ ] **Step 4: Add billing tests** for image fee once plus reported image-associated tokens where expected; assert a provider tariff is never counted twice. Add voice duration tests and Whisper’s published price conversion with 20 MKredit floor.
- [ ] **Step 5: Update runtime metering** to consume shared economics while retaining reservation/settlement, ledger idempotency, and reconciliation behavior.
- [ ] **Step 6: Run pricing and metering tests**; expect missing modality rates still bill at minimum and no provider cost is fabricated.
- [ ] **Step 7: Commit** as `fix(assist): apply consistent provider pricing floors`.

### Task 3: Allow multiplier reductions and accurately display effective rates

**Files:**
- Modify: `src/providers/validation.ts`
- Modify: `src/runtime.ts`
- Modify: `src/ui.ts`
- Modify: `migrations/0043_media_voice_rate_multiplier.sql` only if migration history inspection shows a forward-compatible schema adjustment is needed; otherwise create the next numbered migration.
- Create: `scripts/operator-pricing.test.mjs`

**Interfaces:**
- Consume the shared pricing result from Task 2.
- Produce operator policy validation accepting 1–1,000% and a Models & Rates UI view showing base cost, minimum applied, multiplier, effective rate, rate source/freshness, and N/A for unsupported modalities.

- [ ] **Step 1: Add failing tests** for 1%, 50%, 100%, and 1,000% multipliers; reject 0%, negative, over-1,000%, non-finite values; assert validation failures return an operator validation error rather than HTTP 500.
- [ ] **Step 2: Run the new policy/UI tests**; verify reductions currently fail validation and current rate table can show a false zero.
- [ ] **Step 3: Update policy validation and persistence** to support separate text and media/voice multipliers in the approved 1–1,000% range; preserve current settings unless explicitly changed.
- [ ] **Step 4: Render effective rates from shared derivation**; display missing provider rate as minimum fallback and unknown provider cost as unavailable, never zero or fabricated.
- [ ] **Step 5: Run `npm run check:operator-ui` and operator pricing tests**; expect all percentage and display cases to pass.
- [ ] **Step 6: Commit** as `feat(assist): expose effective modality prices and reductions`.

### Task 4: Register Luna and safely promote it across Sol-backed aliases

**Files:**
- Modify: `src/billing/provider-derived-pricing.ts`
- Modify: `src/providers/route-readiness.ts`
- Modify: `src/providers/reasoning.ts`
- Create: `migrations/0044_gpt6_luna_primary_remove_sol.sql`
- Create: `scripts/luna-route-migration.test.mjs`
- Modify: `src/runtime.ts` only if route resolution requires an explicit guarded migration entry point.

**Interfaces:**
- Consume verified Luna capability declarations from Task 1 and shared pricing from Task 2.
- Produce a targeted D1 migration moving Azure Foundry `gpt-6-luna-1` to primary for Sol-backed aliases, removing only GPT-5.6 Sol route references, preserving non-Sol targets in relative order, and excluding the Whisper speech alias.

- [ ] **Step 1: Add migration tests using current schema**; seed representative global and customer-specific chains for `mkety-fast`, `mkety-reasoning`, `mkety-smart`, `mkety-vision`, and `mkety-media-vision`, plus `mkety-media-speech`; assert all Sol chains get Luna first, non-Sol order is unchanged, speech is unchanged, and repeated application is safe.
- [ ] **Step 2: Run migration tests**; verify current migration does not satisfy the Luna-primary and complete-Sol-removal assertions.
- [ ] **Step 3: Implement guarded transaction migration**; abort before writes unless Azure Foundry provider/model deployment exists and all affected aliases have a verified Luna capability path. Preserve target IDs/settings for non-Sol targets and customer-specific overrides.
- [ ] **Step 4: Register provider costs/capabilities** for known GPT-5.6 Luna and GPT-6 Luna IDs only where authoritative source data exists; do not use direct OpenAI prices for Azure. Keep modality floors for missing prices.
- [ ] **Step 5: Run migration and route-readiness tests**; expect no Sol model target references in global or customer-specific Assist routes and unchanged fallback ordering.
- [ ] **Step 6: Commit** as `feat(assist): promote Azure GPT-6 Luna and remove Sol routes`.

### Task 5: Release preflight and controlled production cutover

**Files:**
- Modify: `customer-apps/assist/OPERATIONS.md` only if the exact parity checklist or migration command is not already documented.
- Create: `scripts/luna-cutover-acceptance.test.mjs`

**Interfaces:**
- Consume validated code, migration, pricing behavior, and Luna parity predicates from Tasks 1–4.
- Produce a preflight report and a release acceptance checklist requiring the operator to capture current route order, run migration, smoke-test Luna text/image, verify fallbacks and Whisper, and confirm zero Sol references.

- [ ] **Step 1: Add acceptance tests** that fail if any required Sol-backed capability is missing, any Sol route remains, any non-Sol order changes, the speech route changes, or either Luna text/image smoke test fails.
- [ ] **Step 2: Run `npm run check:all`, `npm run type-check`, and `npx wrangler deploy --dry-run`** from `customer-apps/assist`; resolve all failures.
- [ ] **Step 3: Capture production route/rate snapshots** before applying D1 migration; confirm connection and deployment availability without exposing credentials.
- [ ] **Step 4: Apply migration and smoke-test text/image through Luna**; confirm capability parity, customer isolation, unchanged fallbacks and Whisper, and zero Sol references.
- [ ] **Step 5: If acceptance fails, restore saved route configuration and prior Worker version; preserve ledger and balances, and use forward repairs for schema changes.
- [ ] **Step 6: Commit release checks** as `test(assist): gate Luna cutover on capability parity`.

## Self-review

- Spec coverage: pricing formulas/floors/multipliers are Tasks 2–3; provider rate display is Task 3; Sol/Luna capability parity is Task 1 and Task 5; route migration and Sol removal are Task 4; production release/rollback gates are Task 5.
- Test command convention follows `customer-apps/assist/package.json`: unit tests run through Node’s built-in runner over `scripts/*.test.mjs`.
- Capability parity includes every relevant interface/request class; tests must use Azure’s deployment identity, not a generic OpenAI model assumption.
- Migration safety covers idempotency, customer-scoped rows, preservation of non-Sol ordering, and explicit Whisper exclusion.
- No historical ledger, balance, credential, or unrelated product changes are included.
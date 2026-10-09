# Assist provider pricing and GPT-6 Luna cutover

**Status:** Draft for review
**Scope:** Mkety Assist only (`customer-apps/assist`).

## Goals

- Set text minimums to 2,000 MKredit per 1M input tokens and 10,000 MKredit per 1M output tokens.
- Set media minimums to 20 MKredit per image and 20 MKredit per voice minute.
- Derive each base rate as the greater of the authoritative provider rate converted to MKredit and the applicable minimum. Missing provider rates use the minimum.
- Apply separate operator-controlled text and media/voice multipliers after the base rate. Permit reductions below 100%; validate a bounded range of 1% through 1,000%.
- Show the source, unit, verification/effective date, provider base rate, and resulting customer rate. Represent unsupported modalities as not applicable, not a zero rate.
- Support both GPT-5.6 Luna and GPT-6 Luna, including Azure Foundry deployment gpt-6-luna-1. The exact deployment is the new primary on route chains currently using GPT-5.6 Sol.
- Remove GPT-5.6 Sol target references from Assist route configurations. Preserve the Azure provider connection and secrets, all other fallback targets in their current order, and operator ability to reorder eligible targets.
- Preserve the Workers AI Whisper speech route and unrelated providers, aliases, customer records, balances, and ledger entries.

## Pricing design

Use one normalized provider/model/modality/unit rate catalog for rate derivation and display. Each rate records its provider model identifier, amount, currency, billing unit, source type and URL, and last verified/effective date. Prefer provider APIs or authoritative published pricing. Refresh only from authoritative machine-readable sources; record changes for audit and apply new rates prospectively. Do not use OpenAI direct API prices as a substitute for Azure Foundry deployment pricing.

Apply the following formula independently to input tokens, output tokens, image units, and voice minutes:

    base = max(provider rate converted to MKredit, modality minimum)
    customer rate = base × (category multiplier / 100)

For unknown rates, provider cost is unavailable and the minimum remains the billable base; do not show a fabricated provider cost. Confirm the internal MKredit-to-provider-currency conversion and rounding rules against existing Assist billing code before implementation. Keep ledger idempotency and existing reservation/settlement semantics unchanged.

Image usage currently may combine an image fee with token charges. Align rate display and runtime billing: charge the image modality component once at the effective per-image rate, and retain image-associated input/output token charges only where provider usage reports those tokens and the existing billing contract expects them. Avoid charging a provider image tariff twice. Voice remains billed by duration.

## Model and route migration

Preflight must verify that the configured Azure Foundry connection can invoke deployment gpt-6-luna-1, that the deployment accepts text and image inputs, and that every preserved fallback is still eligible. Validate all affected alias chains before writing any route changes. If the deployment identifier, image capability, or a chain is ambiguous, abort without partial changes.

On each Assist chain currently containing GPT-5.6 Sol, put Azure Foundry gpt-6-luna-1 first, then preserve every non-Sol target and its relative order. Remove Sol references from global and customer-specific Assist route records. Leave the Azure provider itself intact. Keep non-Sol targets editable so operators can change priority later. Do not add Luna to the Whisper speech route.

Before cutover, capture the current target order for affected aliases and rates. After cutover, verify effective route resolution and run text and image smoke tests through Luna. Confirm non-Sol fallback ordering, speech routing, and customer isolation. Make database changes transactionally where supported; do not change balances, historical usage, or ledger records.

## Admin experience

Show provider base cost, minimum applied, multiplier, final customer rate, source, and rate freshness for each modality. If a provider rate is missing, label the minimum as the applied fallback. Do not display zero for a billable minimum or imply that an unsupported modality has a known provider cost. Ensure validation accepts multiplier reductions and reports invalid ranges without returning HTTP 500.

## Release and recovery

Implement on the clean branch design/assist-pricing-luna-migration-20261009 based on main; do not use the stale dirty local checkout. Add focused tests for minimums, known higher rates, missing rates, multiplier reductions, rounding, image and voice charging, Luna image eligibility, route ordering, and Sol removal.

Follow customer-apps/assist/OPERATIONS.md release gates: npm run check:all, npm run type-check, and npx wrangler deploy --dry-run. Apply any required D1 migration before Worker deployment. Separate code deployment from route configuration changes; capture a known-good route snapshot and worker version. If post-deploy smoke tests fail, restore the prior route configuration and worker version. Do not roll back migrations destructively; use a forward repair.

## Explicit exclusions

- No change to other products or Assist speech provider.
- No provider credential rotation or deletion.
- No edits to customer balances, historical usage, or ledger entries.
- No automatic rate source unless it is authoritative, structured, auditable, and verified against the unit conversion.

## Provider capability and pricing references

- Azure GPT-6 Luna model capability documentation: accepts text and image input with text output (official Azure model documentation; retrieved 2026-10-09).
- OpenAI direct API pricing is not Azure Foundry pricing and must not be substituted for the configured Azure deployment.
- Cloudflare Workers AI Whisper published price: $0.000453 per minute (official Cloudflare pricing; retrieved 2026-10-09).

## Alternatives considered

1. Keep existing rate fields and add Luna route entries only: rejected because zero/missing display values would continue to obscure fallback billing.
2. Use a shared normalized rate catalog plus targeted route migration: recommended; ensures runtime and admin display use the same price derivation and confines route changes to affected Assist chains.
3. Scrape arbitrary pricing pages continuously: rejected because unstable or non-authoritative pages could silently change customer charges.
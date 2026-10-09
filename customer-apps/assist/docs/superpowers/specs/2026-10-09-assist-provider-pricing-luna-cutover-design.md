# Assist provider pricing and GPT-6 Luna cutover

**Status:** Approved for implementation and release
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

- Azure Foundry GPT-6 Luna supports text and image input, text output, Responses and Chat Completions APIs, streaming, structured outputs, and function/tool calling. Azure documents a 1,050,000-token context window, up to 922,000 input tokens, and up to 128,000 output tokens. Assist uses Responses and its existing prompt-driven action format; native tool-call payloads and provider streaming are not required by current Assist routes.
- Azure documents the supported reasoning effort levels used by Assist, including maximum. The Azure adapter maps Assist maximum to `xhigh`; no OpenAI direct endpoint behavior is assumed.
- The official Azure GPT-6 launch pricing table lists Luna Global Standard short-context at $0.10 input and $0.50 output per million tokens, and long-context at $0.20/$0.75. US and EU Data Zone rates differ. Assist records the Global Standard short-context figure as a labeled public-offer estimate, not an actual per-deployment invoice rate; exact deployment tier and context pricing can only be confirmed from the Azure account.
- Azure GPT-6 model/capability documentation: https://learn.microsoft.com/en-us/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure
- Azure Responses image input format (base64 `input_image` data URI): https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/responses
- Azure GPT-6 reasoning support: https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/reasoning
- Azure published GPT-6 model pricing (retrieved 2026-10-09): https://azure.microsoft.com/en-us/blog/gpt-6-astra-sol-and-luna-for-production-agents-in-microsoft-foundry/
- OpenAI direct API pricing is not Azure Foundry pricing and must not be substituted for the configured Azure deployment.
- Cloudflare Workers AI Whisper published price: $0.000453 per minute (official Cloudflare pricing; retrieved 2026-10-09).

### Verified Assist parity mapping

| Existing Assist behavior | Luna route behavior | Verification |
|---|---|---|
| Text prompts and replies | Azure Foundry Responses API | Provider acceptance probe plus post-migration Luna text smoke test |
| Image analysis | Responses API `input_image` data URL with text prompt | Image target eligibility, preserved multimodal payload, post-migration Luna image smoke test |
| Standard/high/maximum reasoning | Standard sends no extra effort; high sends `high`; maximum sends `xhigh` | Reasoning declaration and request-encoding tests; Azure documentation |
| Assistant actions | Existing prompt-described JSON action handling | Same Assist parser and route request path; native function calls are not used by current app actions |
| Structured output | Existing Assist output/parser contracts | Same text response normalizer and contract tests |
| Streaming | Assist currently returns completed responses; it does not stream provider tokens | No route behavior changes |
| Usage settlement | Responses `input_tokens`, `output_tokens`, and reasoning detail fields | Existing usage normalizer and settlement tests |
| Context/output limits | Azure supports more than the current Assist request budget; runtime continues to cap output at 2,048 tokens | Preserve existing application safety/cost cap |

The production deploy acceptance endpoint now requires an actual text reply and an actual image-input reply from the exact Luna primary targets. It also checks that their Azure connection is active and validated. If either probe fails, the deploy gate fails rather than treating a generic Azure connection check as Luna parity.

## Alternatives considered

1. Keep existing rate fields and add Luna route entries only: rejected because zero/missing display values would continue to obscure fallback billing.
2. Use a shared normalized rate catalog plus targeted route migration: recommended; ensures runtime and admin display use the same price derivation and confines route changes to affected Assist chains.
3. Scrape arbitrary pricing pages continuously: rejected because unstable or non-authoritative pages could silently change customer charges.
## Sol-to-Luna capability parity (approved scope addition)

Before cutover, inventory every user-visible capability and provider constraint exercised through each Sol-backed alias and compare it with Azure Foundry gpt-6-luna-1. Include text input/output, image input and image payload formats, standard/high/maximum reasoning options, streaming, tool/function calls, structured output/JSON behavior, context and output limits, safety/error behavior, usage reporting, and any route-specific settings. Use Azure deployment documentation and controlled tests for the exact deployment.

Make every feature supported by the Sol route available through the Luna-backed Assist experience. Update model capability declarations, request adapters, eligibility checks, reasoning mappings, request limits, and usage normalization as needed. Preserve existing fallback eligibility and order, skipping incompatible targets for a request as current rules require. Do not claim the Luna model itself supports a capability when Azure documentation or invocation tests do not establish it; if a required capability cannot be provided by Luna or an existing non-Sol fallback, block that alias cutover and report the specific gap rather than silently dropping the feature.

Run parity tests for each inventoried capability and request class before changing the production primary. The cutover acceptance condition is zero lost supported Assist capabilities, successful text and image requests through Luna, and unchanged non-Sol fallback availability.

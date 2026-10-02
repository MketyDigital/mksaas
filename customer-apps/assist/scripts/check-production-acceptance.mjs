import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (p) => readFile(new URL("../" + p, import.meta.url), "utf8");
const [runtime,index,ui,payments,providers,providerTypes,metering,handoff,domain,m12,m13,m20,m21,m22,m27,m28,m29,m30,m31,m32,m33] = await Promise.all([
  read("src/runtime.ts"), read("src/index.ts"), read("src/ui.ts"),
  read("src/payments/service.ts"), read("src/providers/validation.ts"), read("src/providers/types.ts"),
  read("src/billing/metering.ts"), read("src/handoff/service.ts"),
  read("src/domains/verification.ts"), read("migrations/0012_payment_purchase_type.sql"),
  read("migrations/0013_customer_security.sql"), read("migrations/0020_provider_capabilities.sql"),
  read("migrations/0021_metering_invariants.sql"), read("migrations/0022_payment_methods.sql"),
  read("migrations/0027_ordered_provider_routes.sql"), read("migrations/0028_workers_gemma_primary.sql"),
  read("migrations/0029_media_capability_routes.sql"), read("migrations/0030_media_usage_metering.sql"),
  read("migrations/0031_true_mkredit_precision.sql"), read("migrations/0032_exact_provider_rate_reconciliation.sql"),
  read("migrations/0033_mkredit_public_unit.sql"),
]);
const [conversationContext, conversationQuality] = await Promise.all([
  read("src/conversation/context.ts"),
  read("src/conversation/quality-probe.ts"),
]);
const contextCache = await read("src/conversation/context-cache.ts");
const settlementJournal = await read("src/billing/settlement-journal.ts");
const inferenceSettlement = await read("src/billing/inference-settlement.ts");
const reasoningProvider = await read("src/providers/reasoning.ts");
const routeReadiness = await read("src/providers/route-readiness.ts");
const [migration34, migration35, migration36] = await Promise.all([
  read("migrations/0034_idempotent_inference_attempts.sql"),
  read("migrations/0035_webhook_processing_lease.sql"),
  read("migrations/0036_assist_reasoning_reconciliation.sql"),
]);

assert.match(index,/password_hash/);
assert.match(index,/setup_tokens/);
assert.match(runtime,/automationPaused/);
assert.match(handoff,/pauseCustomer/);
assert.match(runtime,/model target failed; trying next ordered fallback/);
assert.doesNotMatch(runtime,/if \(!classified\.retryable\) throw error/);
assert.match(runtime,/responseFailure = String\(response\.error \|\| "inference_failed"\)/);
assert.match(runtime,/"UPDATE reply_jobs SET status='delivered',external_delivery_id=\?,completed_at=\?,locked_at=NULL,updated_at=\? WHERE id=\?"/);
assert.match(runtime,/batched_into:/);
assert.match(runtime,/Customer message \$\{index \+ 1\}/);
assert.match(runtime,/UPDATE human_handoffs SET status='resolved'/);
assert.match(runtime,/CAST\(provider_message_id AS INTEGER\)/);
assert.match(runtime,/human_handoff_open/);
assert.match(runtime,/__mketyTargetRate/);
assert.match(inferenceSettlement,/status='released'.*status='open'/s);
assert.match(inferenceSettlement,/status='settled'.*status='open'/s);
assert.match(payments,/nowpayments/);
assert.ok(payments.indexOf('"nowpayments"') < payments.indexOf('"flutterwave"'));
assert.match(payments,/kora/);
assert.match(providerTypes,/strict_byok/);
assert.match(providers,/explicit_paid_fallback/);
assert.match(metering,/creditsAvailable/);
assert.doesNotMatch(metering,/providerCost|multiplier|envelope|reserve/i);
assert.match(domain,/providerPending/);
assert.match(m12,/OLD\.status='pending'.*NEW\.status='paid'/s);
assert.match(m12,/lifetime_granted=lifetime_granted\+NEW\.credits/);
assert.match(m13,/revoked_at/);
assert.match(m20,/customer_model_routes/);
assert.match(m20,/customer_id TEXT REFERENCES customers/);
assert.match(m21,/reservation_id/);
assert.match(index,/validationRequired: true/);
assert.match(index,/customer_provider_requires_matching_tenant_route/);
assert.match(index,/api\.nowpayments\.io\/v1\/invoice/);
assert.match(payments,/verifyNowPaymentsSignature/);
assert.match(index,/x-nowpayments-sig/);
assert.match(index,/api\/payments\/kora\/start/);
assert.match(runtime,/manual_reply_pause_seconds/);
assert.match(runtime,/human_manual_reply/);
assert.match(handoff,/automation_resume_at/);
assert.match(m22,/payment_method_health/);
assert.match(m27,/model_route_targets/);
assert.match(m27,/provider_input_cost_micros_per_million/);
assert.match(m28,/@cf\/google\/gemma-4-26b-a4b-it/);
assert.match(m28,/@cf\/zai-org\/glm-5\.3-flash/);
assert.match(index,/role: "primary", model: "@cf\/google\/gemma-4-26b-a4b-it"/);
assert.match(index,/role: "fallback", model: "@cf\/zai-org\/glm-5\.3-flash"/);
assert.match(runtime,/mediaRouteTargets/);
assert.match(runtime,/mkety-media-vision/);
assert.match(runtime,/mkety-media-speech/);
assert.match(runtime,/vision target failed; trying next capability fallback/);
assert.match(runtime,/speech target failed; trying next capability fallback/);
assert.match(runtime,/reply_parameters/);
assert.match(runtime,/provider_message_id \? String\(job\.provider_message_id\)/);
assert.match(runtime,/modelResponseWasTruncated/);
assert.match(runtime,/@cf\/openai\/whisper".*new Uint8Array\(bytes\)/s);
assert.match(ui,/const syncDelayPreset=/);
assert.match(runtime,/inlineData/);
assert.match(runtime,/input_image/);
assert.match(runtime,/input_audio/);
assert.match(m29,/@cf\/google\/gemma-4-26b-a4b-it/);
assert.match(m29,/@cf\/zai-org\/glm-5\.3-flash/);
assert.match(m29,/@cf\/openai\/whisper-large-v3-turbo/);
assert.match(m29,/@cf\/deepgram\/nova-3/);
assert.match(index,/frontier: \{ azureFoundry: azureOk, vertex: vertexOk \}/);
assert.match(runtime,/media_usage_json/);
assert.match(conversationContext,/CUSTOMER MESSAGE \(caption\/question and attached media are one turn\)/);
assert.match(runtime,/Attached image analysis for this same customer message/);
assert.match(runtime,/Treat each caption\/text and its attached media as one message/);
assert.match(runtime,/Do not answer the customer's business question yourself/);
assert.match(runtime,/reserveMediaUsage/);
assert.match(runtime,/settleMediaUsage/);
assert.match(runtime,/empty_model_response:/);
assert.match(runtime,/image understanding failed/);
assert.match(runtime,/transcription failed/);
assert.doesNotMatch(runtime,/const actualCredits = Math\.max\(1, textCredits \+ mediaCredits\)/);
assert.doesNotMatch(runtime,/additionalProviderCosts: mediaProviderCosts/);
assert.match(runtime,/mediaTargetUsage/);
assert.match(runtime,/function textFromContentParts/);
assert.match(runtime,/__mketyPriorAttempts/);
assert.match(runtime,/routedResultAttempt/);
assert.match(runtime,/primaryCredits/);
assert.match(runtime,/creditsCharged/);
assert.match(runtime,/normalized\.reasoning_effort = selectReasoningEffort[\s\S]*?\|\| "low"/);
assert.match(runtime,/max_completion_tokens = maxCompletion/);
assert.match(runtime,/Math\.min\(2048, parseInt\(String\(input\.max_tokens \|\| 1536\)/);
assert.match(runtime,/max_completion_tokens: 768/);
assert.match(index,/max_completion_tokens: 256/);
assert.match(index,/reasoning_effort: "low"/);
assert.match(index,/function acceptanceText/);
assert.match(index,/workers-ai-image-reply/);
assert.match(index,/workersImageReplyOk/);
assert.match(index,/runConversationQualityProbe/);
assert.match(index,/max_completion_tokens: 256/);
assert.match(index,/max_output_tokens: 1024/);
assert.match(index,/visibleOutputTokens = Math\.max\(0, Math\.ceil\(text\.length \/ 4\)\)/);
assert.match(index,/providerOutputTokens/);
assert.match(index,/conversationQuality: conversationQualityResult/);
assert.match(conversationQuality,/CUSTOMER_TURNS\.slice\(0, 3\)/);
assert.match(conversationQuality,/256-token cap/);
assert.match(conversationContext,/selectCompletionBudget/);
assert.match(contextCache,/input\.customerId/);
assert.match(contextCache,/input\.assistantId/);
assert.match(runtime,/memory_cleared_at/);
assert.match(runtime,/kind: "knowledge_retrieval"/);
assert.match(runtime,/resolveAutomationState\(env\.DB/);
assert.match(runtime,/reserveCredits\(env\.DB/);
assert.match(settlementJournal,/unknown_outcome/);
assert.match(settlementJournal,/assertIdentity/);
assert.match(settlementJournal,/async claimAttempt\(/);
assert.match(runtime,/async function invokeJournaledMediaAttempt/);
assert.match(runtime,/media:\$\{await resilienceSha256Text\(/);
assert.match(runtime,/providerAttemptId,/);
assert.match(inferenceSettlement,/INSERT OR IGNORE INTO inference_settlements/);
assert.match(inferenceSettlement,/await db\.batch\(statements\)/);
assert.match(migration34,/idx_usage_provider_attempt_once/);
assert.match(migration34,/idx_provider_cost_attempt_once/);
assert.match(migration35,/processing_at INTEGER/);
assert.match(migration36,/reasoning_mode TEXT NOT NULL DEFAULT 'standard'/);
assert.match(migration36,/reasoning_fallback_policy TEXT NOT NULL DEFAULT 'allow_lower_effort'/);
assert.match(migration36,/reasoning_units INTEGER NOT NULL DEFAULT 0/);
assert.match(migration36,/requested_reasoning_mode TEXT NOT NULL DEFAULT 'standard'/);
assert.match(migration36,/applied_reasoning_mode TEXT NOT NULL DEFAULT 'standard'/);
assert.match(reasoningProvider,/planReasoningTargets/);
assert.match(reasoningProvider,/fallbackPolicy === "strict"/);
assert.match(reasoningProvider,/requestedMode !== appliedMode/);
assert.match(runtime,/normalizeReasoningMode\(assistant\.reasoning_mode\)/);
assert.match(runtime,/delete requestInput\.reasoning_effort/);
assert.match(runtime,/provider_reasoning_cost_micros_per_million/);
assert.match(inferenceSettlement,/reasoning_units/);
assert.match(index,/reasoningCapabilities\(String\(target\.provider\)/);
assert.match(ui,/data-target-reasoning-high/);
assert.match(ui,/data-target-reasoning-maximum/);
assert.match(index,/media_readiness: mediaReadiness/);
assert.match(index,/active_route_requires_enabled_target/);
assert.match(index,/invalid_model_route_status/);
assert.match(index,/status: row\.override_status/);
assert.match(routeReadiness,/feature_disabled/);
assert.match(routeReadiness,/route_unavailable/);
assert.match(routeReadiness,/alias_paused/);
assert.match(runtime,/routeTargetPricingConfigured\(target, alias\)/);
assert.match(runtime,/inbound_event_in_progress/);
assert.match(m30,/creditUsdMicros/);
assert.match(m30,/provider_audio_cost_micros_per_minute=5200/);
assert.match(m30,/provider_input_cost_micros_per_million=100000/);
assert.match(m31,/mkreditsPerUsd',10000000/);
assert.match(m31,/balance=balance\*10000/);
assert.match(m31,/credits_charged=credits_charged\*10000/);
assert.match(m31,/input_credits_per_million=input_credits_per_million\*10000/);
assert.match(m33,/mkreditsPerUsd',1000/);
assert.match(m33,/creditAtomsPerUsd',10000000/);
assert.match(m33,/creditAtomsPerMkredit',10000/);
assert.match(index,/MKREDITS_PER_USD = 1_000/);
assert.match(index,/CREDIT_ATOMS_PER_USD = 10_000_000/);
assert.match(index,/creditAtomsFromUsdMicros/);
assert.match(index,/mkreditsFromCreditAtoms/);
assert.doesNotMatch(index,/creditUsdMicros/);
assert.match(m32,/provider_audio_cost_micros_per_minute=453/);
assert.match(m32,/provider_input_cost_micros_per_million\*10/);
assert.match(m32,/provider_audio_cost_micros_per_minute\*10/);
assert.match(index,/api\/internal\/inference-acceptance/);
assert.match(index,/api\/internal\/provider-bootstrap/);
assert.match(providers,/openai\/v1\/responses/);
const customerUi = ui.split("export function renderOperatorPortal")[0];
assert.doesNotMatch(customerUi,/provider_envelope_bps|operations_reserve_bps|provider_cost_micros|lifetime_granted|included_credits|minimum_funding_minor|funding_mode/i);
console.log("Assist production acceptance contract: ok");

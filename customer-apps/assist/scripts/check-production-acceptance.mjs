import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (p) => readFile(new URL("../" + p, import.meta.url), "utf8");
const [runtime,index,ui,payments,providers,providerTypes,metering,handoff,domain,m12,m13,m20,m21,m22,m27,m28,m29] = await Promise.all([
  read("src/runtime.ts"), read("src/index.ts"), read("src/ui.ts"),
  read("src/payments/service.ts"), read("src/providers/validation.ts"), read("src/providers/types.ts"),
  read("src/billing/metering.ts"), read("src/handoff/service.ts"),
  read("src/domains/verification.ts"), read("migrations/0012_payment_purchase_type.sql"),
  read("migrations/0013_customer_security.sql"), read("migrations/0020_provider_capabilities.sql"),
  read("migrations/0021_metering_invariants.sql"), read("migrations/0022_payment_methods.sql"),
  read("migrations/0027_ordered_provider_routes.sql"), read("migrations/0028_workers_gemma_primary.sql"),
  read("migrations/0029_media_capability_routes.sql"),
]);

assert.match(index,/password_hash/);
assert.match(index,/setup_tokens/);
assert.match(runtime,/automationPaused/);
assert.match(handoff,/pauseCustomer/);
assert.match(runtime,/model target failed; trying next ordered fallback/);
assert.match(runtime,/__mketyTargetRate/);
assert.match(runtime,/status='released'.*status='open'.*RETURNING reserved_credits/s);
assert.match(runtime,/status='settled'.*status='open'.*RETURNING reserved_credits/s);
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
assert.match(runtime,/inlineData/);
assert.match(runtime,/input_image/);
assert.match(runtime,/input_audio/);
assert.match(m29,/@cf\/google\/gemma-4-26b-a4b-it/);
assert.match(m29,/@cf\/zai-org\/glm-5\.3-flash/);
assert.match(m29,/@cf\/openai\/whisper-large-v3-turbo/);
assert.match(m29,/@cf\/deepgram\/nova-3/);
assert.match(index,/frontier: \{ azureFoundry: azureOk, vertex: vertexOk \}/);
assert.match(index,/api\/internal\/inference-acceptance/);
assert.match(index,/api\/internal\/provider-bootstrap/);
assert.match(providers,/openai\/v1\/responses/);
const customerUi = ui.split("export function renderOperatorPortal")[0];
assert.doesNotMatch(customerUi,/provider_envelope_bps|operations_reserve_bps|provider_cost_micros|lifetime_granted|included_credits|minimum_funding_minor|funding_mode/i);
console.log("Assist production acceptance contract: ok");

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (p) => readFile(new URL("../" + p, import.meta.url), "utf8");
const [runtime,index,ui,payments,providers,metering,handoff,domain,m13,m22] = await Promise.all([
  read("src/runtime.ts"), read("src/index.ts"), read("src/ui.ts"),
  read("src/payments/service.ts"), read("src/providers/validation.ts"),
  read("src/billing/metering.ts"), read("src/handoff/service.ts"),
  read("src/domains/verification.ts"), read("migrations/0013_customer_security.sql"),
  read("migrations/0022_payment_methods.sql"),
]);

assert.match(index,/password_hash/);
assert.match(index,/setup_tokens/);
assert.match(runtime,/automationPaused/);
assert.match(handoff,/pauseCustomer/);
assert.match(runtime,/BYOK provider failed; funded fallback blocked/);
assert.match(runtime,/status='released'.*status='open'.*RETURNING reserved_credits/s);
assert.match(runtime,/status='settled'.*status='open'.*RETURNING reserved_credits/s);
assert.match(payments,/nowpayments/);
assert.ok(payments.indexOf('"nowpayments"') < payments.indexOf('"flutterwave"'));
assert.match(payments,/kora/);
assert.match(providers,/strict_byok/);
assert.match(metering,/creditsAvailable/);
assert.doesNotMatch(metering,/providerCost|multiplier|envelope|reserve/i);
assert.match(domain,/providerPending/);
assert.match(m13,/revoked_at/);
assert.match(m22,/payment_method_health/);
assert.doesNotMatch(ui,/provider_envelope_bps|operations_reserve_bps|provider_cost_micros/i);
console.log("Assist production acceptance contract: ok");

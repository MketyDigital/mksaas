import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildNowPaymentsInvoicePayload,
  canApproveNowPaymentsPartial,
  chooseDefaultNowPaymentsCurrency,
  normalizeNowPaymentsCurrencies,
} from "../src/payments/nowpayments.ts";

test("active NOWPayments currencies are normalized and keep the complete selectable set", () => {
  assert.deepEqual(
    normalizeNowPaymentsCurrencies({ currencies: ["USDTTRC20", { code: "USDTTON" }, "BTC"] }),
    ["usdttrc20", "usdtton", "btc"],
  );
});

test("USDT on TON is the default when enabled, with safe fallbacks", () => {
  assert.equal(chooseDefaultNowPaymentsCurrency(["btc", "usdtton", "usdttrc20"]), "usdtton");
  assert.equal(chooseDefaultNowPaymentsCurrency(["btc", "usdttrc20"]), "usdttrc20");
  assert.equal(chooseDefaultNowPaymentsCurrency(["btc", "eth"]), "btc");
  assert.equal(chooseDefaultNowPaymentsCurrency([]), "");
});

test("invoice stays USD-priced, accepts the selected crypto, and passes fixed-rate fee settings", () => {
  assert.deepEqual(buildNowPaymentsInvoicePayload({
    amountUsd: 10,
    currency: "USDTTON",
    reference: "ASSIST-MKA-example",
    description: "Mkety Assist example",
    callbackUrl: "https://assist.example/api/payment/nowpayments/webhook",
    successUrl: "https://assist.example/payment/return?reference=example",
    cancelUrl: "https://assist.example/payment/return?reference=example",
  }), {
    price_amount: 10,
    price_currency: "usd",
    pay_currency: "usdtton",
    is_fixed_rate: true,
    is_fee_paid_by_user: true,
    order_id: "ASSIST-MKA-example",
    order_description: "Mkety Assist example",
    ipn_callback_url: "https://assist.example/api/payment/nowpayments/webhook",
    success_url: "https://assist.example/payment/return?reference=example",
    cancel_url: "https://assist.example/payment/return?reference=example",
  });
});

test("partial approval requires a provider-matched partial and enough fiat value", () => {
  const checkout = { reference: "ASSIST-MKA-example", canonical_currency: "USD", canonical_amount_minor: 1000 };
  assert.equal(canApproveNowPaymentsPartial({
    payment_id: 123,
    order_id: checkout.reference,
    payment_status: "partially_paid",
    price_currency: "usd",
    price_amount: 10,
    actually_paid_fiat: 10.01,
  }, checkout), true);
  assert.equal(canApproveNowPaymentsPartial({
    payment_id: 123,
    order_id: checkout.reference,
    payment_status: "partially_paid",
    price_currency: "usd",
    price_amount: 10,
    actually_paid_fiat: 9.99,
  }, checkout), false);
  assert.equal(canApproveNowPaymentsPartial({
    payment_id: 123,
    order_id: "different-order",
    payment_status: "partially_paid",
    price_currency: "usd",
    price_amount: 10,
    actually_paid_fiat: 10.01,
  }, checkout), false);
  assert.equal(canApproveNowPaymentsPartial({
    payment_id: 123,
    order_id: checkout.reference,
    payment_status: "finished",
    price_currency: "usd",
    price_amount: 10,
    actually_paid_fiat: 10.01,
  }, checkout), false);
});

test("payment history query exposes provider invoice and payment IDs separately", async () => {
  const index = await readFile(new URL("../src/index.ts", import.meta.url), "utf8");
  assert.match(index, /provider_invoice_id/);
  assert.match(index, /provider_payment_id,provider_pay_currency/);
  assert.match(index, /https:\/\/api\.nowpayments\.io\/v1\/currencies/);
  const ui = await readFile(new URL("../src/ui.ts", import.meta.url), "utf8");
  assert.match(ui, /NOWPayments ID:/);
  assert.match(ui, /providerPaymentId=String\(saved\|\|''\)/);
});

test("migration separates only the old pending invoice ID and preserves other provider IDs", async () => {
  const migration = await readFile(new URL("../migrations/0050_nowpayments_invoice_payment_identity.sql", import.meta.url), "utf8");
  assert.match(migration, /provider_invoice_id=provider_payment_id/);
  assert.match(migration, /provider_payment_id=NULL/);
  assert.match(migration, /provider='nowpayments'\s+AND status='pending'/);
});

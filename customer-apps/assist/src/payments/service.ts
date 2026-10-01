export type PaymentMethod = "nowpayments" | "flutterwave" | "kora";

export type PaymentMethodHealth = {
  nowpayments: boolean;
  flutterwave: boolean;
  kora: boolean;
};

export function listPaymentMethods(health: PaymentMethodHealth): PaymentMethod[] {
  const methods: PaymentMethod[] = [];
  if (health.nowpayments) methods.push("nowpayments");
  if (health.flutterwave) methods.push("flutterwave");
  if (health.kora) methods.push("kora");
  return methods;
}

export function defaultPaymentMethod(health: PaymentMethodHealth): PaymentMethod | null {
  return listPaymentMethods(health)[0] ?? null;
}

export function assertSettlementMatches(input: {
  expectedReference: string;
  actualReference: string;
  expectedAmountMinor: number;
  actualAmountMinor: number;
  expectedCurrency: string;
  actualCurrency: string;
}) {
  if (input.actualReference !== input.expectedReference) throw new Error("settlement_reference_mismatch");
  if (input.actualAmountMinor !== input.expectedAmountMinor) throw new Error("settlement_amount_mismatch");
  if (input.actualCurrency.toUpperCase() !== input.expectedCurrency.toUpperCase()) throw new Error("settlement_currency_mismatch");
}


const paymentEncoder = new TextEncoder();

function sortObjectDeep(value: any): any {
  if (Array.isArray(value)) return value.map(sortObjectDeep);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortObjectDeep(value[key])]));
  }
  return value;
}

function hex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function verifyNowPaymentsSignature(payload: any, signature: string, secret: string) {
  if (!payload || !signature || !secret) return false;
  const key = await crypto.subtle.importKey("raw", paymentEncoder.encode(secret), { name: "HMAC", hash: "SHA-512" }, false, ["sign"]);
  const canonical = JSON.stringify(sortObjectDeep(payload));
  const expected = hex(await crypto.subtle.sign("HMAC", key, paymentEncoder.encode(canonical)));
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}

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

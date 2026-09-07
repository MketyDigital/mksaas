export type SettlementSource = 'selar' | 'nowpayments' | 'manual';

export type NormalizedSettlementStatus = 'verified_success' | 'verified_failure';

export interface NormalizedSettlement {
  provider: SettlementSource;
  providerPaymentId?: string;
  providerEventId?: string;
  subscriptionId: string;
  billingPeriodId: string;
  amountExpectedMinor: bigint;
  currencyExpected: string;
  amountPaidMinor: bigint;
  currencyPaid: string;
  status: NormalizedSettlementStatus;
  occurredAt: Date;
  rawReference?: string;
}

const NORMALIZED_CURRENCY_CODE = /^[A-Z]{3}$/;

export function assertApplicableSettlement(input: NormalizedSettlement): void {
  if (input.status !== 'verified_success') {
    throw new Error('Settlement is not a verified success.');
  }

  if (input.amountExpectedMinor <= 0n) {
    throw new Error('Expected amount must be greater than zero.');
  }

  if (input.amountPaidMinor < 0n) {
    throw new Error('Paid amount cannot be negative.');
  }

  if (!NORMALIZED_CURRENCY_CODE.test(input.currencyExpected)) {
    throw new Error('Expected currency must be a normalized ISO-style currency code.');
  }

  if (!NORMALIZED_CURRENCY_CODE.test(input.currencyPaid)) {
    throw new Error('Paid currency must be a normalized ISO-style currency code.');
  }

  if (input.currencyExpected !== input.currencyPaid) {
    throw new Error('Cross-currency settlement requires an explicit conversion record.');
  }
}

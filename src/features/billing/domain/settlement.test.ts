import { assertApplicableSettlement, type NormalizedSettlement } from './settlement';

const baseSettlement: NormalizedSettlement = {
  provider: 'nowpayments',
  providerPaymentId: 'payment-123',
  providerEventId: 'event-123',
  subscriptionId: 'subscription-123',
  billingPeriodId: 'period-123',
  amountExpectedMinor: 1999n,
  currencyExpected: 'USD',
  amountPaidMinor: 1999n,
  currencyPaid: 'USD',
  status: 'verified_success',
  occurredAt: new Date('2026-09-07T12:00:00.000Z'),
  rawReference: 'provider-event:event-123',
};

describe('assertApplicableSettlement', () => {
  it('accepts a verified successful settlement with valid minor-unit money', () => {
    expect(() => assertApplicableSettlement(baseSettlement)).not.toThrow();
  });

  it('rejects a verified failure', () => {
    expect(() =>
      assertApplicableSettlement({ ...baseSettlement, status: 'verified_failure' }),
    ).toThrow('Settlement is not a verified success.');
  });

  it('rejects a non-positive expected amount', () => {
    expect(() =>
      assertApplicableSettlement({ ...baseSettlement, amountExpectedMinor: 0n }),
    ).toThrow('Expected amount must be greater than zero.');
  });

  it('rejects a negative paid amount', () => {
    expect(() =>
      assertApplicableSettlement({ ...baseSettlement, amountPaidMinor: -1n }),
    ).toThrow('Paid amount cannot be negative.');
  });

  it('rejects malformed or non-normalized currency codes', () => {
    expect(() =>
      assertApplicableSettlement({ ...baseSettlement, currencyExpected: 'usd' }),
    ).toThrow('Expected currency must be a normalized ISO-style currency code.');

    expect(() =>
      assertApplicableSettlement({ ...baseSettlement, currencyPaid: 'USDT' }),
    ).toThrow('Paid currency must be a normalized ISO-style currency code.');
  });

  it('rejects mismatched expected and paid currencies in milestone one', () => {
    expect(() =>
      assertApplicableSettlement({ ...baseSettlement, currencyPaid: 'NGN' }),
    ).toThrow('Cross-currency settlement requires an explicit conversion record.');
  });
});

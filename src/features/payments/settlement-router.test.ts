/** @jest-environment node */

const mockFindContext = jest.fn();
const mockApplySettlement = jest.fn();
const mockMarkCompleted = jest.fn();
const mockMarkAwaiting = jest.fn();
const mockMarkFailed = jest.fn();

jest.mock('@/features/billing/server/drizzle-checkout-settlement', () => ({
  findBillingCheckoutSettlementContext: mockFindContext,
  markBillingCheckoutAwaitingConfirmation: mockMarkAwaiting,
  markBillingCheckoutCompleted: mockMarkCompleted,
  markBillingCheckoutTerminalFailure: mockMarkFailed,
}));

jest.mock('@/features/billing/server/settlement-service', () => ({
  applyVerifiedSettlement: mockApplySettlement,
}));

jest.mock('@/features/billing/server/drizzle-repository', () => ({
  createDrizzleBillingRepository: jest.fn(() => ({ mocked: true })),
}));

jest.mock('@/features/enterprise-checkout/server/repository', () => ({
  enterpriseOrderRepository: {
    findById: jest.fn(),
    applyPaymentState: jest.fn(),
  },
}));

jest.mock('@/shared/db', () => ({ db: {} }));

import { routeVerifiedMketyPayment } from './settlement-router';

describe('routeVerifiedMketyPayment', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockFindContext.mockResolvedValue({
      checkoutId: '5e0d1f40-6bf5-4efd-bd75-a2223fb8ff91',
      subscriptionId: 'subscription-1',
      billingPeriodId: 'period-1',
      amountExpectedMinor: 3999n,
      currency: 'USD',
      providerAmountExpectedMinor: 5656294n,
      providerCurrency: 'NGN',
      provider: 'flutterwave',
    });
    mockApplySettlement.mockResolvedValue({ status: 'applied', settlementId: 'settlement-1' });
  });

  it('verifies local collection currency but applies canonical Mkety settlement', async () => {
    await routeVerifiedMketyPayment({
      source: 'saas',
      targetUuid: '5e0d1f40-6bf5-4efd-bd75-a2223fb8ff91',
      provider: 'flutterwave',
      reference: 'SAAS-MKS-5e0d1f406bf54efdbd75a2223fb8ff91',
      providerPaymentId: 'payment-1',
      providerEventId: 'event-1',
      amount: '56562.94',
      currency: 'NGN',
      status: 'success',
      providerData: {},
      occurredAt: new Date('2026-09-25T12:00:00.000Z'),
    });

    expect(mockApplySettlement.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        amountExpectedMinor: 3999n,
        currencyExpected: 'USD',
        amountPaidMinor: 3999n,
        currencyPaid: 'USD',
        providerAmountPaidMinor: 5656294n,
        providerCurrencyPaid: 'NGN',
      }),
    );
    expect(mockApplySettlement.mock.calls[0]?.[2]).toEqual(expect.any(Date));
    expect(mockMarkCompleted).toHaveBeenCalled();
  });

  it('rejects a provider amount below the stored local-currency quote', async () => {
    await expect(
      routeVerifiedMketyPayment({
        source: 'saas',
        targetUuid: '5e0d1f40-6bf5-4efd-bd75-a2223fb8ff91',
        provider: 'flutterwave',
        reference: 'SAAS-MKS-5e0d1f406bf54efdbd75a2223fb8ff91',
        providerPaymentId: 'payment-1',
        providerEventId: 'event-1',
        amount: '50000.00',
        currency: 'NGN',
        status: 'success',
        providerData: {},
      }),
    ).rejects.toThrow('checkout quote');

    expect(mockApplySettlement).not.toHaveBeenCalled();
  });

  it('rejects a provider amount above the locked local-currency quote', async () => {
    await expect(
      routeVerifiedMketyPayment({
        source: 'saas',
        targetUuid: '5e0d1f40-6bf5-4efd-bd75-a2223fb8ff91',
        provider: 'flutterwave',
        reference: 'SAAS-MKS-5e0d1f406bf54efdbd75a2223fb8ff91',
        providerPaymentId: 'payment-1',
        providerEventId: 'event-1',
        amount: '60000.00',
        currency: 'NGN',
        status: 'success',
        providerData: {},
      }),
    ).rejects.toThrow('checkout quote');

    expect(mockApplySettlement).not.toHaveBeenCalled();
  });

  it('rejects a provider currency different from the stored quote', async () => {
    await expect(
      routeVerifiedMketyPayment({
        source: 'saas',
        targetUuid: '5e0d1f40-6bf5-4efd-bd75-a2223fb8ff91',
        provider: 'flutterwave',
        reference: 'SAAS-MKS-5e0d1f406bf54efdbd75a2223fb8ff91',
        providerPaymentId: 'payment-1',
        providerEventId: 'event-1',
        amount: '56562.94',
        currency: 'GHS',
        status: 'success',
        providerData: {},
      }),
    ).rejects.toThrow('checkout quote');
  });
});

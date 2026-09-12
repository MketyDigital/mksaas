/** @jest-environment node */

const mockVerifyNowPaymentsWebhook = jest.fn();
const mockFindById = jest.fn();
const mockApplyPaymentState = jest.fn();

jest.mock('@/features/enterprise-checkout/providers/nowpayments-webhook', () => ({
  verifyNowPaymentsWebhook: mockVerifyNowPaymentsWebhook,
}));
jest.mock('@/features/enterprise-checkout/server/repository', () => ({
  enterpriseOrderRepository: {
    findById: mockFindById,
    applyPaymentState: mockApplyPaymentState,
  },
}));

import { POST } from './route';

describe('POST /api/webhooks/enterprise/nowpayments', () => {
  const previousSecret = process.env.NOWPAYMENTS_IPN_SECRET;

  beforeEach(() => {
    jest.resetAllMocks();
    process.env.NOWPAYMENTS_IPN_SECRET = 'webhook-secret';
  });

  afterAll(() => {
    process.env.NOWPAYMENTS_IPN_SECRET = previousSecret;
  });

  it('fails closed when verification rejects the signature', async () => {
    mockVerifyNowPaymentsWebhook.mockRejectedValue(new Error('Invalid NOWPayments signature.'));
    const response = await POST(
      new Request('https://mkety.com/api/webhooks/enterprise/nowpayments', {
        method: 'POST',
        headers: { 'x-nowpayments-sig': 'bad' },
        body: '{}',
      }),
    );

    expect(response.status).toBe(400);
    expect(mockApplyPaymentState).not.toHaveBeenCalled();
  });

  it('confirms only a verified finished event', async () => {
    mockVerifyNowPaymentsWebhook.mockResolvedValue({
      orderId: 'MKETY-ENT-1',
      paymentId: 'pay-1',
      paymentStatus: 'finished',
    });
    mockFindById.mockResolvedValue({
      id: 'MKETY-ENT-1',
      paymentProvider: 'nowpayments',
    });
    mockApplyPaymentState.mockResolvedValue({});

    const response = await POST(
      new Request('https://mkety.com/api/webhooks/enterprise/nowpayments', {
        method: 'POST',
        headers: { 'x-nowpayments-sig': 'valid' },
        body: '{}',
      }),
    );

    expect(response.status).toBe(200);
    expect(mockApplyPaymentState).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'MKETY-ENT-1',
        paymentStatus: 'confirmed',
        checkoutStatus: 'completed',
        providerPaymentReference: 'pay-1',
      }),
    );
  });
});

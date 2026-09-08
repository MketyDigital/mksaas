const verifyNowPaymentsWebhook = jest.fn();
const findById = jest.fn();
const applyPaymentState = jest.fn();

jest.mock('@/features/enterprise-checkout/providers/nowpayments-webhook', () => ({ verifyNowPaymentsWebhook }));
jest.mock('@/features/enterprise-checkout/server/repository', () => ({
  enterpriseOrderRepository: { findById, applyPaymentState },
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
    verifyNowPaymentsWebhook.mockRejectedValue(new Error('Invalid NOWPayments signature.'));
    const response = await POST(new Request('https://mkety.com/api/webhooks/enterprise/nowpayments', {
      method: 'POST', headers: { 'x-nowpayments-sig': 'bad' }, body: '{}',
    }));
    expect(response.status).toBe(400);
    expect(applyPaymentState).not.toHaveBeenCalled();
  });

  it('confirms only a verified finished event', async () => {
    verifyNowPaymentsWebhook.mockResolvedValue({ orderId: 'MKETY-ENT-1', paymentId: 'pay-1', paymentStatus: 'finished' });
    findById.mockResolvedValue({ id: 'MKETY-ENT-1', paymentProvider: 'nowpayments' });
    applyPaymentState.mockResolvedValue({});

    const response = await POST(new Request('https://mkety.com/api/webhooks/enterprise/nowpayments', {
      method: 'POST', headers: { 'x-nowpayments-sig': 'valid' }, body: '{}',
    }));

    expect(response.status).toBe(200);
    expect(applyPaymentState).toHaveBeenCalledWith(expect.objectContaining({
      orderId: 'MKETY-ENT-1', paymentStatus: 'confirmed', checkoutStatus: 'completed', providerPaymentReference: 'pay-1',
    }));
  });
});

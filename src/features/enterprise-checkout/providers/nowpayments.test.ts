import { createNowPaymentsAdapter } from './nowpayments';

const input = {
  orderId: 'MKETY-ENT-123',
  customer: { fullName: 'Ada Lovelace', companyName: 'Analytical Engines', email: 'ada@example.com' },
  project: { name: 'Enterprise AI rollout' },
  amountMinor: BigInt(19999),
  currency: 'USD' as const,
  provider: 'nowpayments' as const,
};

describe('NOWPayments enterprise adapter', () => {
  it('builds a canonical Mkety invoice request', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'invoice-1', invoice_url: 'https://nowpayments.io/payment/?iid=invoice-1' }),
    });
    const adapter = createNowPaymentsAdapter({ apiKey: 'secret', fetchImpl: fetchMock });

    const result = await adapter.createCheckout(input);
    const [, request] = fetchMock.mock.calls[0];
    const body = JSON.parse(request.body);

    expect(body).toMatchObject({
      price_amount: 199.99,
      price_currency: 'usd',
      order_id: 'MKETY-ENT-123',
      ipn_callback_url: 'https://mkety.com/api/webhooks/enterprise/nowpayments',
      success_url: 'https://mkety.com/payment/enterprise/success?orderId=MKETY-ENT-123',
      cancel_url: 'https://mkety.com/payment/enterprise/cancelled?orderId=MKETY-ENT-123',
    });
    expect(result.status).toBe('checkout_created');
  });

  it('fails closed when the API key is missing', async () => {
    const fetchMock = jest.fn();
    const adapter = createNowPaymentsAdapter({ apiKey: undefined, fetchImpl: fetchMock });
    await expect(adapter.createCheckout(input)).rejects.toThrow('NOWPayments is not configured');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

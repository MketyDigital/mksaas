/** @jest-environment node */

const createEnterpriseCheckout = jest.fn();

jest.mock('@/features/enterprise-checkout/server/service', () => ({
  enterpriseCheckoutService: { createEnterpriseCheckout },
}));

import { POST } from './route';

describe('POST /api/payments/enterprise/create', () => {
  beforeEach(() => createEnterpriseCheckout.mockReset());

  it('rejects cross-origin requests before invoking checkout', async () => {
    const request = new Request('https://mkety.com/api/payments/enterprise/create', {
      method: 'POST',
      headers: { Origin: 'https://evil.example', 'Content-Type': 'application/json' },
      body: '{}',
    });
    const response = await POST(request);
    expect(response.status).toBe(403);
    expect(createEnterpriseCheckout).not.toHaveBeenCalled();
  });

  it('returns only normalized checkout fields', async () => {
    createEnterpriseCheckout.mockResolvedValue({
      orderId: 'MKETY-ENT-1',
      provider: 'nowpayments',
      redirectUrl: 'https://nowpayments.example/invoice',
      status: 'checkout_created',
    });
    const request = new Request('https://mkety.com/api/payments/enterprise/create', {
      method: 'POST',
      headers: { Origin: 'https://mkety.com', 'Content-Type': 'application/json', 'Idempotency-Key': 'abcdefgh' },
      body: JSON.stringify({ ok: true }),
    });
    const response = await POST(request);
    const body = await response.json();
    expect(response.status).toBe(201);
    expect(body).toEqual({
      success: true,
      orderId: 'MKETY-ENT-1',
      provider: 'nowpayments',
      redirectUrl: 'https://nowpayments.example/invoice',
      status: 'checkout_created',
    });
  });
});

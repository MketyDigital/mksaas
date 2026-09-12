/** @jest-environment node */

const createEnterpriseCheckout = jest.fn();

jest.mock('@/features/enterprise-checkout/server/service', () => ({
  enterpriseCheckoutService: { createEnterpriseCheckout },
}));

import { POST } from './route';

describe('POST /api/payments/enterprise/create', () => {
  beforeEach(() => createEnterpriseCheckout.mockReset());

  it('blocks public customer-created Enterprise payment links', async () => {
    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({
      success: false,
      message: 'Enterprise payment links are issued by Mkety after the project scope and payment amount are agreed.',
    });
    expect(createEnterpriseCheckout).not.toHaveBeenCalled();
  });
});

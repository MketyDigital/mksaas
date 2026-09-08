import type { EnterpriseCheckoutProviderAdapter } from '../providers/types';
import { createEnterpriseCheckoutService } from './service';

const request = {
  fullName: 'Jane Doe',
  companyName: 'Acme Ltd',
  email: 'jane@acme.test',
  projectName: 'AI Support Deployment',
  projectDescription: 'Enterprise support assistant',
  amount: '199.99',
  currency: 'USD',
  provider: 'nowpayments',
};

describe('enterprise checkout service', () => {
  it('creates the auditable order before invoking the provider', async () => {
    const calls: string[] = [];
    const repository = {
      async findByIdempotencyKey() { return null; },
      async createOrder(input: any) { calls.push('order'); return { ...input, checkoutStatus: 'created', paymentStatus: 'pending', createdAt: new Date(), updatedAt: new Date(), confirmedAt: null }; },
      async updateCheckout() { calls.push('update'); return undefined; },
    };
    const adapter: EnterpriseCheckoutProviderAdapter = {
      provider: 'nowpayments',
      async createCheckout() { calls.push('provider'); return { provider: 'nowpayments', redirectUrl: 'https://invoice.example/1', status: 'checkout_created', providerCheckoutReference: 'inv-1' }; },
    };

    const service = createEnterpriseCheckoutService({ repository: repository as any, getProvider: () => adapter, createOrderId: () => 'MKETY-ENT-1' });
    await service.createEnterpriseCheckout(request, { idempotencyKey: 'idem-1' });
    expect(calls).toEqual(['order', 'provider', 'update']);
  });

  it('replays the same idempotent checkout without calling the provider again', async () => {
    let providerCalls = 0;
    const repository = {
      async findByIdempotencyKey() {
        return {
          id: 'MKETY-ENT-1', customerName: 'Jane Doe', companyName: 'Acme Ltd', email: 'jane@acme.test', phone: null, country: null,
          scopeId: null, projectName: 'AI Support Deployment', projectDescription: 'Enterprise support assistant', amountMinor: 19999n,
          currency: 'USD', paymentProvider: 'nowpayments', checkoutStatus: 'redirected', paymentStatus: 'pending', providerCheckoutReference: 'inv-1',
          providerPaymentReference: null, idempotencyKey: 'idem-1', metadata: { requestFingerprint: expect.any(String), redirectUrl: 'https://invoice.example/1' },
          createdAt: new Date(), updatedAt: new Date(), confirmedAt: null,
        };
      },
      async createOrder() { throw new Error('must not create'); },
      async updateCheckout() { throw new Error('must not update'); },
    };
    const adapter: EnterpriseCheckoutProviderAdapter = {
      provider: 'nowpayments',
      async createCheckout() { providerCalls += 1; throw new Error('must not call'); },
    };
    const service = createEnterpriseCheckoutService({ repository: repository as any, getProvider: () => adapter, createOrderId: () => 'unused' });
    const result = await service.createEnterpriseCheckout(request, { idempotencyKey: 'idem-1' });
    expect(result.orderId).toBe('MKETY-ENT-1');
    expect(providerCalls).toBe(0);
  });

  it('keeps the order auditable when the provider fails', async () => {
    let created = false;
    const repository = {
      async findByIdempotencyKey() { return null; },
      async createOrder(input: any) { created = true; return { ...input, checkoutStatus: 'created', paymentStatus: 'pending' }; },
      async updateCheckout() { return undefined; },
    };
    const adapter: EnterpriseCheckoutProviderAdapter = { provider: 'nowpayments', async createCheckout() { throw new Error('provider down'); } };
    const service = createEnterpriseCheckoutService({ repository: repository as any, getProvider: () => adapter, createOrderId: () => 'MKETY-ENT-2' });
    await expect(service.createEnterpriseCheckout(request, { idempotencyKey: 'idem-2' })).rejects.toThrow('Enterprise checkout is temporarily unavailable.');
    expect(created).toBe(true);
  });
});

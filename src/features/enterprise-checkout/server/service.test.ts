import type { PlatformEnterpriseOrder } from '@/shared/db/schema/platform-enterprise-orders';

import type { EnterpriseCheckoutProviderAdapter } from '../providers/types';
import type { EnterpriseOrderRepository } from './repository';
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

function makeOrder(overrides: Partial<PlatformEnterpriseOrder> = {}): PlatformEnterpriseOrder {
  return {
    id: 'MKETY-ENT-1',
    customerName: 'Jane Doe',
    companyName: 'Acme Ltd',
    email: 'jane@acme.test',
    phone: null,
    country: null,
    scopeId: null,
    projectName: 'AI Support Deployment',
    projectDescription: 'Enterprise support assistant',
    amountMinor: BigInt(19999),
    currency: 'USD',
    paymentProvider: 'nowpayments',
    checkoutStatus: 'created',
    paymentStatus: 'pending',
    providerCheckoutReference: null,
    providerPaymentReference: null,
    idempotencyKey: 'aaaaaaaa',
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    confirmedAt: null,
    ...overrides,
  };
}

describe('enterprise checkout service', () => {
  it('creates the auditable order before invoking the provider', async () => {
    const calls: string[] = [];
    const repository: EnterpriseOrderRepository = {
      async findByIdempotencyKey() { return null; },
      async createOrder() { calls.push('order'); return makeOrder(); },
      async updateCheckout() { calls.push('update'); },
      async applyPaymentState() { return makeOrder(); },
      async findById() { return null; },
    };
    const adapter: EnterpriseCheckoutProviderAdapter = {
      provider: 'nowpayments',
      async createCheckout() { calls.push('provider'); return { provider: 'nowpayments', redirectUrl: 'https://invoice.example/1', status: 'checkout_created', providerCheckoutReference: 'inv-1' }; },
    };

    const service = createEnterpriseCheckoutService({ repository, getProvider: () => adapter, createOrderId: () => 'MKETY-ENT-1' });
    await service.createEnterpriseCheckout(request, { idempotencyKey: 'aaaaaaaa' });
    expect(calls).toEqual(['order', 'provider', 'update']);
  });

  it('replays the same idempotent checkout without calling the provider again', async () => {
    let providerCalls = 0;
    const repository: EnterpriseOrderRepository = {
      async findByIdempotencyKey() {
        return makeOrder({
          checkoutStatus: 'redirected',
          providerCheckoutReference: 'inv-1',
          idempotencyKey: 'aaaaaaaa',
          metadata: { redirectUrl: 'https://invoice.example/1' },
        });
      },
      async createOrder() { throw new Error('must not create'); },
      async updateCheckout() { throw new Error('must not update'); },
      async applyPaymentState() { throw new Error('must not apply payment state'); },
      async findById() { return null; },
    };
    const adapter: EnterpriseCheckoutProviderAdapter = {
      provider: 'nowpayments',
      async createCheckout() { providerCalls += 1; throw new Error('must not call'); },
    };
    const service = createEnterpriseCheckoutService({ repository, getProvider: () => adapter, createOrderId: () => 'unused' });
    const result = await service.createEnterpriseCheckout(request, { idempotencyKey: 'aaaaaaaa' });
    expect(result.orderId).toBe('MKETY-ENT-1');
    expect(providerCalls).toBe(0);
  });

  it('keeps the order auditable when the provider fails', async () => {
    let created = false;
    const repository: EnterpriseOrderRepository = {
      async findByIdempotencyKey() { return null; },
      async createOrder() { created = true; return makeOrder({ id: 'MKETY-ENT-2', idempotencyKey: 'bbbbbbbb' }); },
      async updateCheckout() {},
      async applyPaymentState() { return makeOrder(); },
      async findById() { return null; },
    };
    const adapter: EnterpriseCheckoutProviderAdapter = { provider: 'nowpayments', async createCheckout() { throw new Error('provider down'); } };
    const service = createEnterpriseCheckoutService({ repository, getProvider: () => adapter, createOrderId: () => 'MKETY-ENT-2' });
    await expect(service.createEnterpriseCheckout(request, { idempotencyKey: 'bbbbbbbb' })).rejects.toThrow('Enterprise checkout is temporarily unavailable.');
    expect(created).toBe(true);
  });
});

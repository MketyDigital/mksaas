import type { PlatformEnterpriseOrder } from '@/shared/db/schema/platform-enterprise-orders';

import type { EnterpriseOrderRepository } from './repository';
import { createEnterpriseCheckoutService } from './service';
import type { EnterpriseCheckoutProviderAdapter } from '../providers/types';
import { hashEnterprisePaymentToken } from './payment-capability';

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
    checkoutTokenHash: null,
    checkoutTokenExpiresAt: null,
    providerPayCurrency: null,
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
    let createdMetadata: Record<string, unknown> | undefined;
    const repository: EnterpriseOrderRepository = {
      async findByIdempotencyKey() {
        return null;
      },
      async createOrder(input) {
        calls.push('order');
        createdMetadata = input.metadata;
        return makeOrder();
      },
      async updateCheckout() {
        calls.push('update');
      },
      async applyPaymentState() {
        return makeOrder();
      },
      async findById() {
        return null;
      },
      async findByCheckoutTokenHash() { return null; },
      async beginInvoiceCreation() { return null; },
    };
    const adapter: EnterpriseCheckoutProviderAdapter = {
      provider: 'nowpayments',
      async createCheckout() {
        calls.push('provider');
        return {
          provider: 'nowpayments',
          redirectUrl: 'https://invoice.example/1',
          status: 'checkout_created',
          providerCheckoutReference: 'inv-1',
        };
      },
    };

    const service = createEnterpriseCheckoutService({
      repository,
      getProvider: () => adapter,
      createOrderId: () => 'MKETY-ENT-1',
    });
    const onOrderCreated = async (orderId: string) => {
      calls.push(`offer:${orderId}`);
    };
    const context = {
      idempotencyKey: 'aaaaaaaa',
      mailEnterpriseOfferId: 'offer-1',
      mailEnterpriseTenantId: 'tenant-1',
      onOrderCreated,
    } as Parameters<typeof service.createEnterpriseCheckout>[1];
    await service.createEnterpriseCheckout(request, context);
    expect(calls).toEqual(['order', 'offer:MKETY-ENT-1', 'provider', 'update']);
    expect(createdMetadata).toMatchObject({ mailEnterpriseOfferId: 'offer-1', mailEnterpriseTenantId: 'tenant-1' });
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
      async createOrder() {
        throw new Error('must not create');
      },
      async updateCheckout() {
        throw new Error('must not update');
      },
      async applyPaymentState() {
        throw new Error('must not apply payment state');
      },
      async findById() {
        return null;
      },
      async findByCheckoutTokenHash() { return null; },
      async beginInvoiceCreation() { return null; },
    };
    const adapter: EnterpriseCheckoutProviderAdapter = {
      provider: 'nowpayments',
      async createCheckout() {
        providerCalls += 1;
        throw new Error('must not call');
      },
    };
    const service = createEnterpriseCheckoutService({
      repository,
      getProvider: () => adapter,
      createOrderId: () => 'unused',
    });
    const result = await service.createEnterpriseCheckout(request, { idempotencyKey: 'aaaaaaaa' });
    expect(result.orderId).toBe('MKETY-ENT-1');
    expect(providerCalls).toBe(0);
  });

  it('keeps the order auditable and runs failure cleanup when the provider fails', async () => {
    let created = false;
    let orderMarkedFailed = false;
    const failureCalls: string[] = [];
    const repository: EnterpriseOrderRepository = {
      async findByIdempotencyKey() {
        return null;
      },
      async createOrder() {
        created = true;
        return makeOrder({ id: 'MKETY-ENT-2', idempotencyKey: 'bbbbbbbb' });
      },
      async updateCheckout() { orderMarkedFailed = true; },
      async applyPaymentState() {
        return makeOrder();
      },
      async findById() {
        return null;
      },
      async findByCheckoutTokenHash() { return null; },
      async beginInvoiceCreation() { return null; },
    };
    const adapter: EnterpriseCheckoutProviderAdapter = {
      provider: 'nowpayments',
      async createCheckout() {
        throw new Error('provider down');
      },
    };
    const service = createEnterpriseCheckoutService({
      repository,
      getProvider: () => adapter,
      createOrderId: () => 'MKETY-ENT-2',
    });
    const failureContext = {
      idempotencyKey: 'bbbbbbbb',
      onCheckoutFailed: async (orderId: string) => {
        expect(orderMarkedFailed).toBe(true);
        failureCalls.push(orderId);
      },
    } as unknown as Parameters<typeof service.createEnterpriseCheckout>[1];
    await expect(service.createEnterpriseCheckout(request, failureContext)).rejects.toThrow(
      'Enterprise checkout is temporarily unavailable.',
    );
    expect(created).toBe(true);
    expect(failureCalls).toEqual(['MKETY-ENT-2']);
  });

  it('issues a hashed, expiring paypoint without creating a provider invoice until the customer chooses a ticker', async () => {
    let created: Parameters<EnterpriseOrderRepository['createOrder']>[0] | undefined;
    let providerCalls = 0;
    const repository: EnterpriseOrderRepository = {
      async findByIdempotencyKey() { return null; },
      async createOrder(input) { created = input; return makeOrder(input); },
      async updateCheckout() {},
      async applyPaymentState() { return makeOrder(); },
      async findById() { return null; },
      async findByCheckoutTokenHash() { return null; },
      async beginInvoiceCreation() { return null; },
    };
    const adapter: EnterpriseCheckoutProviderAdapter = {
      provider: 'nowpayments',
      async createCheckout() { providerCalls++; throw new Error('invoice must be deferred'); },
    };
    const service = createEnterpriseCheckoutService({ repository, getProvider: () => adapter, createOrderId: () => 'MKETY-ENT-deferred' });
    const result = await service.createEnterpriseCheckout(request, { idempotencyKey: 'deferred1', deferNowPaymentsInvoice: true });
    expect(result.redirectUrl).toMatch(/^https:\/\/mkety\.com\/payment\/enterprise\/checkout\?token=[a-f0-9]{64}$/);
    const token = new URL(result.redirectUrl).searchParams.get('token')!;
    expect(created?.checkoutStatus).toBe('awaiting_payment_selection');
    expect(created?.checkoutTokenHash).toBe(await hashEnterprisePaymentToken(token));
    expect(created?.checkoutTokenExpiresAt).toBeInstanceOf(Date);
    expect(created?.metadata).not.toHaveProperty('checkoutToken');
    expect(providerCalls).toBe(0);
  });

  it('creates the customer-selected currency invoice only after claiming the one-time order state', async () => {
    const token = 'a'.repeat(64);
    const tokenHash = await hashEnterprisePaymentToken(token);
    const calls: string[] = [];
    const order = makeOrder({ checkoutStatus: 'awaiting_payment_selection', checkoutTokenHash: tokenHash,
      checkoutTokenExpiresAt: new Date(Date.now() + 60_000) });
    const repository: EnterpriseOrderRepository = {
      async findByIdempotencyKey() { return null; },
      async createOrder() { throw new Error('not called'); },
      async updateCheckout(input) { calls.push(`update:${input.checkoutStatus}`); },
      async applyPaymentState() { return order; },
      async findById() { return order; },
      async findByCheckoutTokenHash() { return order; },
      async beginInvoiceCreation(_orderId, ticker) { calls.push(`claim:${ticker}`); return order; },
    };
    const adapter: EnterpriseCheckoutProviderAdapter = {
      provider: 'nowpayments',
      async createCheckout(input) {
        calls.push(`invoice:${input.payCurrency}`);
        return { provider: 'nowpayments', redirectUrl: 'https://mkety.com/payment/nowpayments?iid=inv-1', status: 'checkout_created', providerCheckoutReference: 'inv-1' };
      },
    };
    const service = createEnterpriseCheckoutService({ repository, getProvider: () => adapter });
    const result = await service.startNowPaymentsInvoice({ token, payCurrency: 'USDTTRC20' });
    expect(result.redirectUrl).toBe('https://mkety.com/payment/nowpayments?iid=inv-1');
    expect(calls).toEqual(['claim:USDTTRC20', 'invoice:USDTTRC20', 'update:redirected']);
  });
});

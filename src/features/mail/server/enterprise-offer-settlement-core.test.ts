import type { MailEnterpriseOffer } from '@/shared/db/schema/mail-enterprise-offers';
import type { PlatformEnterpriseOrder } from '@/shared/db/schema/platform-enterprise-orders';
import { prepareMailEnterpriseOfferActivation } from './enterprise-offer-settlement-core';

const offer = {
  id: 'offer-1', tenantId: 'tenant-1', name: 'Starpips Mail', description: null, amountMinor: 125000n,
  currency: 'USD', termDays: 365, limits: {} as MailEnterpriseOffer['limits'], status: 'awaiting_payment',
  orderId: 'order-1', createdByUserId: 'ops-user', paidAt: null, startsAt: null, endsAt: null,
  createdAt: new Date(0), updatedAt: new Date(0),
} satisfies MailEnterpriseOffer;

const order = {
  id: 'order-1', customerName: 'Customer', companyName: 'Starpips', email: 'buyer@example.test', phone: null,
  country: null, scopeId: 'mail', projectName: 'Starpips Mail', projectDescription: null, amountMinor: 125000n,
  currency: 'USD', paymentProvider: 'kora', checkoutStatus: 'completed', paymentStatus: 'confirmed',
  providerCheckoutReference: null, providerPaymentReference: 'provider-payment', idempotencyKey: 'offer-one',
  metadata: { mailEnterpriseOfferId: 'offer-1', mailEnterpriseTenantId: 'tenant-1' },
  createdAt: new Date(0), updatedAt: new Date(0), confirmedAt: new Date(1000),
} satisfies PlatformEnterpriseOrder;

describe('Mail Enterprise payment activation', () => {
  it('activates only the matching tenant offer and starts its term at verified payment time', () => {
    expect(prepareMailEnterpriseOfferActivation(offer, order, new Date(1000))).toEqual({
      paidAt: new Date(1000), startsAt: new Date(1000), endsAt: new Date(31_536_001_000),
    });
  });

  it('rejects mismatched orders and unsupported provider paths', () => {
    expect(() => prepareMailEnterpriseOfferActivation(offer, { ...order, amountMinor: 100n })).toThrow('amount');
    expect(() => prepareMailEnterpriseOfferActivation(offer, {
      ...order, metadata: { ...order.metadata, mailEnterpriseTenantId: 'tenant-2' },
    })).toThrow('tenant');
    expect(() => prepareMailEnterpriseOfferActivation(offer, { ...order, paymentProvider: 'nowpayments' })).toThrow('Flutterwave or Kora');
  });

  it('does not extend or create a second active grant on a duplicate callback', () => {
    expect(prepareMailEnterpriseOfferActivation({ ...offer, status: 'active' }, order)).toBeNull();
  });
});

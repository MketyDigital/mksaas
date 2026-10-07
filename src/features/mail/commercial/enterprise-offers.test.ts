import { parseMailEnterpriseOfferInput } from './enterprise-offers';

const goodInput = {
  tenantId: '11111111-1111-4111-8111-111111111111',
  name: 'Starpips Mail Enterprise',
  amountMinor: 10000n,
  termDays: 365,
  limits: {
    domains: 10,
    mailboxes: 100,
    teamSeats: 25,
    sharedInboxes: 10,
    storageGb: 100,
    outboundMessagesPerMonth: 50000,
    customerUpdateDeliveriesPerMonth: 15000,
    maxRecipientsPerCustomerUpdate: 3000,
  },
};

describe('Mail Enterprise offer input', () => {
  it('keeps the entered commercial terms and all enforced limits', () => {
    expect(parseMailEnterpriseOfferInput(goodInput)).toEqual({ ...goodInput, description: undefined });
  });

  it('rejects invalid terms and limits rather than silently rounding or granting a default', () => {
    expect(() => parseMailEnterpriseOfferInput({ ...goodInput, amountMinor: 0n })).toThrow('Offer amount');
    expect(() => parseMailEnterpriseOfferInput({
      ...goodInput,
      limits: { ...goodInput.limits, outboundMessagesPerMonth: 0 },
    })).toThrow('outboundMessagesPerMonth');
    expect(() => parseMailEnterpriseOfferInput({ ...goodInput, tenantId: 'starpips' })).toThrow('workspace');
  });
});

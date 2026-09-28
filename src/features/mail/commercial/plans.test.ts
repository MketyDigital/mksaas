import { getMailCommercialPlan, MAIL_COMMERCIAL_PLANS, MAIL_PREPAID_ADDONS } from './plans';

describe('Mkety Mail commercial plans', () => {
  it('publishes three self-service plans with exact monthly USD prices', () => {
    expect(MAIL_COMMERCIAL_PLANS['mail-starter'].amountMinor).toBe(499n);
    expect(MAIL_COMMERCIAL_PLANS['mail-growth'].amountMinor).toBe(999n);
    expect(MAIL_COMMERCIAL_PLANS['mail-business'].amountMinor).toBe(2499n);
  });

  it('keeps every public Customer Update send within the implemented 3,000-recipient safety ceiling', () => {
    for (const plan of Object.values(MAIL_COMMERCIAL_PLANS)) {
      expect(plan.limits.maxRecipientsPerCustomerUpdate).toBeLessThanOrEqual(3_000);
    }
  });

  it('uses bounded prepaid add-ons rather than unlimited/postpaid self-service overage', () => {
    expect(MAIL_PREPAID_ADDONS.outbound10k.amountMinor).toBeGreaterThan(0n);
    expect(MAIL_PREPAID_ADDONS.storage10Gb.amountMinor).toBeGreaterThan(0n);
    expect(MAIL_PREPAID_ADDONS.customerUpdates5k.amountMinor).toBeGreaterThan(0n);
  });

  it('fails closed for unknown plans', () => {
    expect(() => getMailCommercialPlan('enterprise')).toThrow('Unknown Mkety Mail plan');
  });
});

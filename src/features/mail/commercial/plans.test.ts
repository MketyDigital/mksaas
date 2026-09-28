import { getMailCommercialPlan, MAIL_COMMERCIAL_PLANS } from './plans';

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

  it('fails closed for unknown plans', () => {
    expect(() => getMailCommercialPlan('enterprise')).toThrow('Unknown Mkety Mail plan');
  });
});

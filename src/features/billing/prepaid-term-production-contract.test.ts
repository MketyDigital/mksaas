/** @jest-environment node */

import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();

async function read(relativePath: string) {
  return readFile(path.join(root, relativePath), 'utf8');
}

describe('self-service prepaid billing production contract', () => {
  it('uses the selected term for the authoritative checkout amount and paid period', async () => {
    const [checkoutService, repository, route] = await Promise.all([
      read('src/features/billing/server/self-service-checkout.ts'),
      read('src/features/billing/server/drizzle-self-service-checkout-repository.ts'),
      read('src/app/api/tenants/[tenant]/billing/checkout/route.ts'),
    ]);

    expect(checkoutService).toContain('getSelfServiceBillingQuote(input.planKey, input.termKey)');
    expect(checkoutService).toContain('prepared.amountExpectedMinor !== quote.amountMinor');
    expect(repository).toContain('addMonths(periodStart, quote.term.months)');
    expect(repository).toContain('amountDueMinor: quote.amountMinor');
    expect(repository).toContain('amountExpectedMinor: quote.amountMinor');
    expect(route).toContain('isSelfServiceBillingTermKey(termKey)');
    expect(route).toContain('termKey,');
  });

  it('preserves the selected term on the customer-facing pricing and checkout surfaces', async () => {
    const [pricing, checkout] = await Promise.all([
      read('src/features/platform-content/components/public/pages/MketyPricingPlans.tsx'),
      read('src/app/(tenant)/t/[tenant]/billing/checkout/page.tsx'),
    ]);

    expect(pricing).toContain('SELF_SERVICE_BILLING_TERMS');
    expect(pricing).toContain('term.discountPercent');
    expect(pricing).toContain('withTerm(plan.ctaHref, termKey)');
    expect(checkout).toContain('SELF_SERVICE_BILLING_TERMS');
    expect(checkout).toContain('name="termKey"');
    expect(checkout).toContain('quote.effectiveMonthlyMinor');
  });
});

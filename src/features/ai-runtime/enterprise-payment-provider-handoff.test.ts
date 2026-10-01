/** @jest-environment node */

import { readFile } from 'node:fs/promises';

describe('Enterprise AI provider handoff', () => {
  it('uses the central Mkety Flutterwave broker for billing handoff', async () => {
    const source = await readFile('src/features/billing/gateways/flutterwave.ts', 'utf8');

    expect(source).toContain('createCentralFlutterwaveCheckout');
    expect(source).toContain("source: 'saas'");
    expect(source).toContain('brokerSecret');
    expect(source).not.toContain('createFlutterwaveHostedCheckout');
  });

  it('surfaces a safe NOWPayments invoice rejection reason', async () => {
    const source = await readFile('src/features/billing/gateways/nowpayments.ts', 'utf8');

    expect(source).toContain('NOWPayments rejected invoice creation');
    expect(source).toContain('payload?.message ?? payload?.error');
    expect(source).toContain('response.status');
  });
});

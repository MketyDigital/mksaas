/** @jest-environment node */

import { readFile } from 'node:fs/promises';

describe('Enterprise AI payment launcher', () => {
  it('starts checkout with JSON and only navigates after receiving a checkout URL', async () => {
    const source = await readFile('src/features/ai-runtime/components/EnterpriseAiCheckoutForm.tsx', 'utf8');

    expect(source).toContain("headers: { 'Content-Type': 'application/json' }");
    expect(source).toContain('window.location.assign(payload.checkoutUrl)');
    expect(source).toContain("Payment checkout could not be created");
  });

  it('only exposes payment gateways that are actually configured', async () => {
    const page = await readFile('src/app/app/[tenant]/enterprise-ai/page.tsx', 'utf8');

    expect(page).toContain('process.env.NOWPAYMENTS_API_KEY && process.env.NOWPAYMENTS_IPN_SECRET');
    expect(page).toContain('process.env.FLUTTERWAVE_PUBLIC_KEY');
    expect(page).toContain('process.env.KORA_PUBLIC_KEY && process.env.KORA_SECRET_KEY');
    expect(page).not.toContain('<option value="kora">Kora</option>');
    expect(page).not.toContain('<option value="kora">Card / bank · Kora</option>');
  });
});

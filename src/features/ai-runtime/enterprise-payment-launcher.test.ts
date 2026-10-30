/** @jest-environment node */

import { readFile } from 'node:fs/promises';

describe('Enterprise AI payment launcher', () => {
  it('starts checkout with JSON and only navigates after receiving a checkout URL', async () => {
    const source = await readFile('src/features/ai-runtime/components/EnterpriseAiCheckoutForm.tsx', 'utf8');

    expect(source).toContain("headers: { 'Content-Type': 'application/json' }");
    expect(source).toContain('window.location.assign(payload.checkoutUrl)');
    expect(source).toContain("Payment checkout could not be created");
  });

  it('loads active NOWPayments networks and sends the selected ticker to the server', async () => {
    const source = await readFile('src/features/ai-runtime/components/EnterpriseAiCheckoutForm.tsx', 'utf8');
    const route = await readFile('src/app/api/tenants/[tenant]/enterprise-ai/checkout/route.ts', 'utf8');
    const contract = await readFile('src/features/ai-runtime/server/enterprise-contracts.ts', 'utf8');

    expect(source).toContain("fetch('/api/payments/nowpayments/currencies'");
    expect(source).toContain('payCurrency');
    expect(source).toContain('currencyOptions.map');
    expect(route).toContain('payCurrency?: string');
    expect(route).toContain('payCurrency: provider === \'nowpayments\' ? String(body.payCurrency ?? \'\') : undefined');
    expect(contract).toContain('payCurrency?: string');
    expect(contract).toContain('payCurrency: input.payCurrency');
  });

  it('only exposes payment gateways that are actually configured', async () => {
    const page = await readFile('src/app/app/[tenant]/enterprise-ai/page.tsx', 'utf8');

    expect(page).toContain('getAvailableMketyPaymentProviders({');
    expect(page).toContain('apiKey: process.env.NOWPAYMENTS_API_KEY');
    expect(page).toContain('ipnSecret: process.env.NOWPAYMENTS_IPN_SECRET');
    expect(page).toContain('brokerSecret: process.env.FLUTTERWAVE_CHECKOUT_BROKER_SECRET');
    expect(page).toContain('getMketyFlutterwaveProviderConfig(paymentSettings.flutterwave.fxRates)');
    expect(page).not.toContain('FLUTTERWAVE_STANDARD_SECRET_KEY');
    expect(page).not.toContain('FLUTTERWAVE_STANDARD_WEBHOOK_HASH');
    expect(page).toContain('kora: { publicKey: process.env.KORA_PUBLIC_KEY, secretKey: process.env.KORA_SECRET_KEY }');
    expect(page).not.toContain('<option value="kora">Kora</option>');
    expect(page).not.toContain('<option value="kora">Card / bank · Kora</option>');
  });
});

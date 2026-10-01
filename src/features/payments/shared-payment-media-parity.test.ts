/** @jest-environment node */

import { readFile } from 'node:fs/promises';

describe('shared payment Media parity', () => {
  it('routes platform and Enterprise Flutterwave through the central Mkety broker', async () => {
    const [broker, billing, enterprise] = await Promise.all([
      readFile('src/features/payments/central-flutterwave-broker.ts', 'utf8'),
      readFile('src/features/billing/gateways/flutterwave.ts', 'utf8'),
      readFile('src/features/enterprise-checkout/providers/flutterwave.ts', 'utf8'),
    ]);

    expect(broker).toContain('https://mkety.com/api/payments/flutterwave/start');
    expect(broker).toContain('checkout_experience: requestedExperience');
    expect(broker).toContain("options.experience ?? 'inline'");
    expect(broker).toContain("experience: 'hosted'");
    expect(broker).toContain('Authorization: `Bearer ${options.brokerSecret}`');
    expect(billing).toContain('createCentralFlutterwaveCheckout');
    expect(billing).toContain("source: 'saas'");
    expect(enterprise).toContain('createCentralFlutterwaveCheckout');
    expect(enterprise).toContain("source: 'enterprise'");
    const [billingPage, enterprisePage] = await Promise.all([
      readFile('src/app/payments/flutterwave/inline/page.tsx', 'utf8'),
      readFile('src/app/payment/enterprise/flutterwave/page.tsx', 'utf8'),
    ]);
    expect(billingPage).toContain('FlutterwaveInlineLauncher');
    expect(billingPage).toContain("experience: 'inline'");
    expect(enterprisePage).toContain('FlutterwaveInlineLauncher');
    expect(enterprisePage).toContain("experience: 'inline'");
  });

  it('uses canonical short NOWPayments references while retaining legacy billing webhook compatibility', async () => {
    const [billing, enterprise, webhook] = await Promise.all([
      readFile('src/features/billing/gateways/nowpayments.ts', 'utf8'),
      readFile('src/features/enterprise-checkout/providers/nowpayments.ts', 'utf8'),
      readFile('src/app/api/webhooks/enterprise/nowpayments/route.ts', 'utf8'),
    ]);

    expect(billing).toContain("createMketyPaymentReference('saas', input.checkoutId)");
    expect(billing).toContain('const legacy = /^MKBILL-');
    expect(enterprise).toContain("createMketyPaymentReference('enterprise'");
    expect(webhook).toContain('parseMketyPaymentReference(event.orderId)');
    expect(webhook).toContain('resolvedOrderId');
  });

  it('wires the shared broker secret into the app host and customer payment visibility', async () => {
    const [workflow, page, route] = await Promise.all([
      readFile('.github/workflows/mkety-app-host-production-repair.yml', 'utf8'),
      readFile('src/app/app/[tenant]/enterprise-ai/page.tsx', 'utf8'),
      readFile('src/app/api/tenants/[tenant]/enterprise-ai/checkout/route.ts', 'utf8'),
    ]);

    expect(workflow).toContain('FLUTTERWAVE_CHECKOUT_BROKER_SECRET');
    expect(workflow).toContain('put_secret FLUTTERWAVE_CHECKOUT_BROKER_SECRET');
    expect(page).toContain('process.env.FLUTTERWAVE_CHECKOUT_BROKER_SECRET');
    expect(route).toContain('brokerSecret: process.env.FLUTTERWAVE_CHECKOUT_BROKER_SECRET');
  });
});

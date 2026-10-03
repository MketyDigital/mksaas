import fs from 'node:fs';
import path from 'node:path';

describe('Flutterwave readiness page contract', () => {
  const pages = [
    'src/app/app/[tenant]/billing/checkout/page.tsx',
    'src/app/app/[tenant]/enterprise-ai/page.tsx',
    'src/app/ops/[tenant]/platform-control/enterprise-payments/page.tsx',
    'src/app/ops/[tenant]/platform-control/[module]/page.tsx',
  ];

  it.each(pages)('%s uses the normalized FX readiness helper', (relativePath) => {
    const source = fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
    expect(source).toContain('getMketyFlutterwaveProviderConfig(');
    expect(source).not.toMatch(/Object\.keys\(paymentSettings\??\.flutterwave\.fxRates\)/);
  });
});

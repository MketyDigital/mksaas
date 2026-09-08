import { createSelarAdapter } from './selar';

const input = {
  orderId: 'MKETY-ENT-123',
  customer: {
    fullName: 'Ada Lovelace',
    companyName: 'Analytical Engines',
    email: 'ada@example.com',
    phone: '+2348000000000',
  },
  project: { name: 'Enterprise AI rollout' },
  amountMinor: 19999n,
  currency: 'USD' as const,
  provider: 'selar' as const,
};

describe('Selar enterprise adapter', () => {
  it('uses the configured hosted checkout and remains awaiting confirmation', async () => {
    const adapter = createSelarAdapter({ checkoutUrl: 'https://selar.co/m/mkety-enterprise' });
    const result = await adapter.createCheckout(input);
    const url = new URL(result.redirectUrl);

    expect(url.origin).toBe('https://selar.co');
    expect(url.searchParams.get('add_to_cart')).toBe('1');
    expect(url.searchParams.get('email')).toBe('ada@example.com');
    expect(url.searchParams.get('fullname')).toBe('Ada Lovelace');
    expect(url.searchParams.get('mobile')).toBe('+2348000000000');
    expect(url.searchParams.get('orderId')).toBe('MKETY-ENT-123');
    expect(url.searchParams.get('amount')).toBe('199.99');
    expect(result.status).toBe('awaiting_confirmation');
  });

  it('fails closed when the checkout URL is missing or non-https', () => {
    expect(() => createSelarAdapter({ checkoutUrl: undefined })).toThrow('Selar is not configured');
    expect(() => createSelarAdapter({ checkoutUrl: 'http://selar.co/test' })).toThrow('Selar checkout URL must use HTTPS');
  });
});

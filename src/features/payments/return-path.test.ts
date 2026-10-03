import { buildTenantPaymentReturnPath, normalizeTenantPaymentReturnPath } from './return-path';

describe('tenant payment return paths', () => {
  it('builds canonical billing returns and preserves the chosen plan and term', () => {
    expect(
      buildTenantPaymentReturnPath({
        tenantSlug: 'example-team',
        surface: 'billing',
        planKey: 'mail-standard',
        termKey: '12m',
        currency: 'NGN',
        state: 'returned',
      }),
    ).toBe('/app/example-team/billing/checkout?plan=mail-standard&term=12m&currency=NGN&payment=returned');
  });

  it('builds canonical Enterprise AI returns', () => {
    expect(
      buildTenantPaymentReturnPath({
        tenantSlug: 'example-team',
        surface: 'enterprise-ai',
        state: 'cancelled',
      }),
    ).toBe('/app/example-team/enterprise-ai?payment=cancelled');
  });

  it('normalizes only same-tenant legacy aliases and preserves safe query parameters', () => {
    expect(
      normalizeTenantPaymentReturnPath(
        '/t/example-team/billing/checkout?plan=mail-standard&term=12m&currency=NGN&payment=returned',
        'example-team',
      ),
    ).toBe('/app/example-team/billing/checkout?plan=mail-standard&term=12m&currency=NGN&payment=returned');
    expect(
      normalizeTenantPaymentReturnPath('/t/example-team/enterprise-ai?payment=cancelled', 'example-team'),
    ).toBe('/app/example-team/enterprise-ai?payment=cancelled');
  });

  it.each([
    'https://evil.example/return',
    '//evil.example/return',
    '/app/another-team/billing/checkout',
    '/app/example-team/admin',
    '/t/another-team/enterprise-ai',
    '/app/example-team/billing/checkout?next=https://evil.example',
    '/app/example-team/billing/checkout#fragment',
    '/app/example-team/billing/checkout/extra',
  ])('rejects unsafe return path %s', (path) => {
    expect(normalizeTenantPaymentReturnPath(path, 'example-team')).toBeNull();
  });

  it.each(['../other', 'with.dot', 'UPPERCASE', ''])('rejects malformed tenant slug %s', (tenantSlug) => {
    expect(
      normalizeTenantPaymentReturnPath(`/app/${tenantSlug}/billing/checkout`, tenantSlug),
    ).toBeNull();
  });
});

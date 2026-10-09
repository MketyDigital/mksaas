import { resolveFirstPartyIngressAlias } from './ingress-aliases';

describe('first-party Zoho-to-Mail ingress aliases', () => {
  it('maps an ingress address on the Cloudflare subdomain to its root-domain Mail mailbox', () => {
    expect(resolveFirstPartyIngressAlias({
      configuredTenantId: 'reserved-tenant',
      targetTenantId: 'reserved-tenant',
      mailboxAddress: 'support@mkety.com',
      ingressDomain: 'mail.mkety.com',
    })).toEqual({ ingressAddress: 'support@mail.mkety.com', mailboxAddress: 'support@mkety.com' });
  });

  it.each([
    ['missing configured tenant', { configuredTenantId: '' }],
    ['another tenant', { targetTenantId: 'customer-tenant' }],
    ['hello remains Zoho-owned', { mailboxAddress: 'hello@mkety.com' }],
    ['wrong mailbox domain', { mailboxAddress: 'support@example.com' }],
    ['wrong ingress domain', { ingressDomain: 'example.com' }],
    ['invalid mailbox address', { mailboxAddress: 'not-an-email' }],
  ])('rejects %s', (_label, override) => {
    const input = {
      configuredTenantId: 'reserved-tenant',
      targetTenantId: 'reserved-tenant',
      mailboxAddress: 'info@mkety.com',
      ingressDomain: 'mail.mkety.com',
      ...override,
    };
    expect(resolveFirstPartyIngressAlias(input)).toBeNull();
  });
});

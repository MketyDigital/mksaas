import {
  areCloudflareEmailAuthRecordsPublished,
  getMailDomainProvisioningPolicy,
  isFirstPartyMailDomain,
  shouldCreatePerMailboxWorkerRule,
} from './domain-provisioning-policy';

describe('mail domain provisioning safety', () => {
  it('allows root-domain sending for the first-party tenant without routing or MX changes', () => {
    expect(getMailDomainProvisioningPolicy('mkety.com')).toEqual({ allowed: false, configureRouting: false, configureSending: false });
    expect(getMailDomainProvisioningPolicy(' MKETY.COM. ')).toEqual({ allowed: false, configureRouting: false, configureSending: false });
    expect(getMailDomainProvisioningPolicy('mkety.com', true)).toEqual({ allowed: true, configureRouting: false, configureSending: true });
  });

  it('reserves the mail subdomain for first-party sending and ingress routing', () => {
    expect(getMailDomainProvisioningPolicy('mail.mkety.com')).toEqual({ allowed: false, configureRouting: false, configureSending: false });
    expect(getMailDomainProvisioningPolicy('mail.mkety.com', true)).toEqual({ allowed: true, configureRouting: true, configureSending: true });
  });

  it('only recognizes the reserved sender under the configured first-party tenant', () => {
    expect(isFirstPartyMailDomain('mail.mkety.com', 'reserved-tenant', 'reserved-tenant')).toBe(true);
    expect(isFirstPartyMailDomain('mail.mkety.com', 'customer-tenant', 'reserved-tenant')).toBe(false);
    expect(isFirstPartyMailDomain('other.example', 'reserved-tenant', 'reserved-tenant')).toBe(false);
  });

  it('uses one apex catch-all rule for first-party root mailboxes', () => {
    expect(shouldCreatePerMailboxWorkerRule('mkety.com', true)).toBe(false);
    expect(shouldCreatePerMailboxWorkerRule('mail.mkety.com', true)).toBe(true);
    expect(shouldCreatePerMailboxWorkerRule('customer.example', false)).toBe(true);
  });

  it('allows customer domains to use the normal routing and sending setup', () => {
    expect(getMailDomainProvisioningPolicy('customer.example')).toEqual({ allowed: true, configureRouting: true, configureSending: true });
  });
});

describe('Cloudflare Email Sending DNS verification', () => {
  const expected = [
    { type: 'TXT', name: 'mail.mkety.com', content: 'v=spf1 include:_spf.mx.cloudflare.net ~all' },
    { type: 'TXT', name: 'selector._domainkey.mail.mkety.com', content: 'v=DKIM1; k=rsa; p=public-key' },
    { type: 'TXT', name: '_dmarc.mail.mkety.com', content: 'v=DMARC1; p=reject' },
  ];

  it('does not treat an enabled sending subdomain as authenticated without public DNS matches', () => {
    expect(areCloudflareEmailAuthRecordsPublished('mail.mkety.com', true, expected, [])).toBe(false);
  });

  it('requires matching SPF, DKIM, and DMARC records at their expected names', () => {
    expect(areCloudflareEmailAuthRecordsPublished(
      'mail.mkety.com',
      true,
      expected,
      expected.map((record) => ({ ...record, name: `${record.name}.` })),
    )).toBe(true);
    expect(areCloudflareEmailAuthRecordsPublished('mail.mkety.com', false, expected, expected)).toBe(false);
    expect(areCloudflareEmailAuthRecordsPublished('mail.mkety.com', true, expected, expected.slice(0, 2))).toBe(false);
    expect(areCloudflareEmailAuthRecordsPublished(
      'mail.mkety.com',
      true,
      expected,
      [
        { ...expected[0], name: 'mail.mkety.com.', content: '"v=spf1  include:_spf.mx.cloudflare.net ~all"' },
        { ...expected[1], name: 'selector._domainkey.mail.mkety.com.', content: '"v=DKIM1; k=rsa; p=public-key"' },
        { ...expected[2], name: '_dmarc.mail.mkety.com.', content: '"v=DMARC1;  p=reject"' },
      ],
    )).toBe(true);
  });

  it('accepts Cloudflare bounce-subdomain SPF and an existing valid root DMARC policy', () => {
    const rootExpected = [
      { type: 'TXT', name: 'cf-bounce.mkety.com', content: 'v=spf1 include:_spf.mx.cloudflare.net ~all' },
      { type: 'TXT', name: 'selector._domainkey.mkety.com', content: 'v=DKIM1; k=rsa; p=public-key' },
    ];
    const rootPublished = [
      ...rootExpected,
      { type: 'TXT', name: '_dmarc.mkety.com', content: 'v=DMARC1; p=none' },
    ];

    expect(areCloudflareEmailAuthRecordsPublished('mkety.com', true, rootExpected, rootPublished)).toBe(true);
    expect(areCloudflareEmailAuthRecordsPublished('mkety.com', true, rootExpected, rootExpected)).toBe(false);
  });
});

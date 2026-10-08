import { areCloudflareEmailAuthRecordsPublished, getMailDomainProvisioningPolicy } from './domain-provisioning-policy';

describe('mail domain provisioning safety', () => {
  it('blocks the Zoho-hosted root domain from Cloudflare provisioning', () => {
    expect(getMailDomainProvisioningPolicy('mkety.com')).toEqual({ allowed: false, configureRouting: false, configureSending: false });
    expect(getMailDomainProvisioningPolicy(' MKETY.COM. ')).toEqual({ allowed: false, configureRouting: false, configureSending: false });
  });

  it('reserves the mail subdomain for the first-party tenant and keeps it outbound-only', () => {
    expect(getMailDomainProvisioningPolicy('mail.mkety.com')).toEqual({ allowed: false, configureRouting: false, configureSending: false });
    expect(getMailDomainProvisioningPolicy('mail.mkety.com', true)).toEqual({ allowed: true, configureRouting: false, configureSending: true });
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
  });
});

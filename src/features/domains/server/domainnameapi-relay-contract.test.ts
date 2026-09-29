import fs from 'node:fs';
import path from 'node:path';

describe('DomainNameAPI fixed-egress relay contract', () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), 'ops/domainnameapi-relay/server.mjs'),
    'utf8',
  );

  it('is not a general-purpose proxy and exposes only official operations', () => {
    expect(source).toContain("['quote', { method: 'POST', path: '/domains/bulk-search' }]");
    expect(source).toContain("['pricing', { method: 'GET', path: '/products/tlds' }]");
    expect(source).toContain("['register', { method: 'POST', path: '/domains/register-with-contacts' }]");
    expect(source).toContain("['renew', { method: 'POST', path: '/domains/renew' }]");
    expect(source).toContain("if (!operation) return json(res, 400, { error: 'unsupported_operation' })");
    expect(source).not.toContain('input.url');
    expect(source).not.toContain('input.path');
  });

  it('uses the official REST bases and header authentication', () => {
    expect(source).toContain("https://api.domainresellerapi.com/api/v1");
    expect(source).toContain("https://ote.domainresellerapi.com/api/v1");
    expect(source).toContain("'X-API-KEY': apiKey");
    expect(source).toContain("'__reseller': resellerId");
    expect(source).not.toContain('Authorization:');
  });

  it('requires HMAC authentication, freshness and replay protection', () => {
    expect(source).toContain("createHmac('sha256', sharedSecret)");
    expect(source).toContain('age > 60_000');
    expect(source).toContain('timingSafeEqual');
    expect(source).toContain('replayed_or_invalid_nonce');
    expect(source).toContain('seenNonces');
  });

  it('strips provider credentials out of the upstream JSON body', () => {
    expect(source).toContain('const { resellerId: _resellerId, apiKey: _apiKey, ...providerPayload } = input.payload');
    expect(source).not.toMatch(/console\.(?:log|info|warn|error)\([^\n]*(?:rawBody|input|apiKey|resellerId)/);
  });
});

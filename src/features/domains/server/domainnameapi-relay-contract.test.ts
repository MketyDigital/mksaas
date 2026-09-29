import fs from 'node:fs';
import path from 'node:path';

describe('DomainNameAPI fixed-egress relay contract', () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), 'ops/domainnameapi-relay/server.mjs'),
    'utf8',
  );

  it('is not a general-purpose proxy', () => {
    expect(source).toContain("['quote', { method: 'POST', path: '/v1/domain/check' }]");
    expect(source).toContain("['register', { method: 'POST', path: '/v1/domain/register' }]");
    expect(source).toContain("['renew', { method: 'POST', path: '/v1/domain/renew' }]");
    expect(source).toContain("if (!operation) return json(res, 400, { error: 'unsupported_operation' })");
    expect(source).not.toContain('input.url');
    expect(source).not.toContain('input.path');
  });

  it('requires HMAC authentication, freshness and replay protection', () => {
    expect(source).toContain("createHmac('sha256', sharedSecret)");
    expect(source).toContain("age > 60_000");
    expect(source).toContain("timingSafeEqual");
    expect(source).toContain("replayed_or_invalid_nonce");
    expect(source).toContain("seenNonces");
  });

  it('keeps production and OT&E upstreams explicit', () => {
    expect(source).toContain("https://api.domainresellerapi.com");
    expect(source).toContain("https://ote.domainresellerapi.com");
    expect(source).toContain("input.environment !== 'production'");
    expect(source).toContain("input.environment !== 'ote'");
  });

  it('does not log request bodies or provider credentials', () => {
    expect(source).not.toMatch(/console\.(?:log|info|warn|error)\([^\n]*(?:rawBody|input|apiKey|resellerId)/);
  });
});

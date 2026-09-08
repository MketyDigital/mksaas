import {
  createPublicVisitorToken,
  parsePublicVisitorToken,
  PUBLIC_AI_VISITOR_COOKIE,
} from './visitor';

describe('Public Mkety AI anonymous visitor identity', () => {
  const secret = '0123456789abcdef0123456789abcdef';

  it('creates an opaque signed token that round-trips to the visitor id', async () => {
    const visitorId = '2f91d3b1-df4d-4cb2-81be-d03a4309c40a';
    const token = await createPublicVisitorToken(visitorId, secret);

    expect(token).not.toContain('tenant');
    expect(token).not.toContain('person');
    await expect(parsePublicVisitorToken(token, secret)).resolves.toBe(visitorId);
  });

  it('rejects a tampered token', async () => {
    const token = await createPublicVisitorToken('2f91d3b1-df4d-4cb2-81be-d03a4309c40a', secret);
    const tampered = `${token.slice(0, -1)}${token.endsWith('a') ? 'b' : 'a'}`;

    await expect(parsePublicVisitorToken(tampered, secret)).resolves.toBeNull();
  });

  it('uses a dedicated narrowly named public AI cookie', () => {
    expect(PUBLIC_AI_VISITOR_COOKIE).toBe('mkety_public_ai_visitor');
  });
});

import { assertPublicHttpsUrl } from './outbound-url';

describe('public provider endpoint validation', () => {
  it.each([
    'https://[::ffff:127.0.0.1]/v1',
    'https://[::ffff:10.0.0.1]/v1',
    'https://[::ffff:169.254.169.254]/v1',
    'https://[::ffff:7f00:1]/v1',
    'https://localhost/v1',
    'https://10.0.0.1/v1',
  ])('rejects private endpoint %s', (endpoint) => {
    expect(() => assertPublicHttpsUrl(endpoint)).toThrow('public internet host');
  });
  it('accepts public standard HTTPS provider endpoints', () => {
    expect(assertPublicHttpsUrl('https://inference.mkety.com/v1').hostname).toBe('inference.mkety.com');
  });
  it('rejects embedded URL credentials', () => {
    const endpoint = new URL('https://inference.mkety.com');
    endpoint.username = 'synthetic-user';
    endpoint.password = 'synthetic-password';
    expect(() => assertPublicHttpsUrl(endpoint.toString())).toThrow();
  });
  it.each([
    'http://inference.mkety.com/v1',
    'https://inference.mkety.com:8443/v1',
  ])('rejects insecure endpoint %s', (endpoint) => {
    expect(() => assertPublicHttpsUrl(endpoint)).toThrow();
  });
});

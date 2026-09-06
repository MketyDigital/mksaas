import { executeAutomationHttpAction, isPublicAutomationHttpAddress } from './http-action-runtime';

describe('HTTP action runtime policy', () => {
  it.each([
    '127.0.0.1', '10.0.0.1', '172.16.0.1', '192.168.1.1', '169.254.1.1', '100.64.0.1', '0.0.0.0', '224.0.0.1',
    '::', '::1', 'fc00::1', 'fd00::1', 'fe80::1', 'ff02::1', '::ffff:127.0.0.1', '::ffff:10.0.0.1',
  ])('rejects non-public address %s', (address) => {
    expect(isPublicAutomationHttpAddress(address)).toBe(false);
  });

  it.each(['93.184.216.34', '2606:2800:220:1:248:1893:25c8:1946'])('accepts public address %s', (address) => {
    expect(isPublicAutomationHttpAddress(address)).toBe(true);
  });

  it('rejects HTTP and localhost before transport', async () => {
    await expect(executeAutomationHttpAction({ method: 'GET', url: 'http://example.com' }, { resolve: jest.fn(), request: jest.fn() })).rejects.toThrow('HTTP action requires an HTTPS URL.');
    await expect(executeAutomationHttpAction({ method: 'GET', url: 'https://localhost/test' }, { resolve: jest.fn(), request: jest.fn() })).rejects.toThrow('HTTP action destination is not publicly routable.');
  });

  it('normalizes JSON, text, empty, redirect, error, size, and timeout outcomes through bounded transport results', async () => {
    const resolve = jest.fn().mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
    const jsonRequest = jest.fn().mockResolvedValue({ body: Buffer.from('{"ok":true}'), status: 200 });
    await expect(executeAutomationHttpAction({ method: 'GET', url: 'https://example.com' }, { resolve, request: jsonRequest })).resolves.toEqual(expect.objectContaining({ status: 200, responseType: 'json', data: { ok: true } }));

    const textRequest = jest.fn().mockResolvedValue({ body: Buffer.from('hello'), status: 200 });
    await expect(executeAutomationHttpAction({ method: 'GET', url: 'https://example.com' }, { resolve, request: textRequest })).resolves.toEqual(expect.objectContaining({ responseType: 'text', data: 'hello' }));

    const emptyRequest = jest.fn().mockResolvedValue({ body: Buffer.alloc(0), status: 204 });
    await expect(executeAutomationHttpAction({ method: 'GET', url: 'https://example.com' }, { resolve, request: emptyRequest })).resolves.toEqual(expect.objectContaining({ responseType: 'empty', data: null }));

    await expect(executeAutomationHttpAction({ method: 'GET', url: 'https://example.com' }, { resolve, request: jest.fn().mockResolvedValue({ body: Buffer.alloc(0), status: 302 }) })).rejects.toThrow('HTTP action redirects are not enabled.');
    await expect(executeAutomationHttpAction({ method: 'GET', url: 'https://example.com' }, { resolve, request: jest.fn().mockResolvedValue({ body: Buffer.from('missing'), status: 404 }) })).rejects.toThrow('HTTP action failed with status 404: missing');
    await expect(executeAutomationHttpAction({ method: 'GET', url: 'https://example.com' }, { resolve, request: jest.fn().mockRejectedValue(new Error('HTTP action response exceeded 262144 bytes.')) })).rejects.toThrow('HTTP action response exceeded 262144 bytes.');
    await expect(executeAutomationHttpAction({ method: 'GET', url: 'https://example.com' }, { resolve, request: jest.fn().mockRejectedValue(new Error('HTTP action timed out after 10000ms.')) })).rejects.toThrow('HTTP action timed out after 10000ms.');
  });

  it('passes only transport-controlled data and JSON body metadata', async () => {
    const resolve = jest.fn().mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
    const request = jest.fn().mockResolvedValue({ body: Buffer.from('{}'), status: 200 });
    await executeAutomationHttpAction({ method: 'POST', url: 'https://example.com', body: '{"name":"Ada"}' }, { resolve, request });
    expect(request).toHaveBeenCalledWith(expect.objectContaining({ method: 'POST', body: '{"name":"Ada"}', resolvedAddress: '93.184.216.34' }));
    expect(request.mock.calls[0][0]).not.toHaveProperty('headers');
  });
});

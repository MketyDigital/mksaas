describe('Cloudflare-safe structured logger', () => {
  it('writes through console instead of Node fs/stdout destinations', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.resetModules();

    const { createLogger } = await import('./logger');
    const log = createLogger({ module: 'cloudflare-test' });

    expect(() => log.error({ errorName: 'ExampleError' }, 'example failure')).not.toThrow();
    expect(logSpy).toHaveBeenCalled();

    logSpy.mockRestore();
  });
});

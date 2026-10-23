const mockRedirect = jest.fn((location: string): never => {
  throw new Error(`REDIRECT:${location}`);
});

jest.mock('next/navigation', () => ({ redirect: (location: string) => mockRedirect(location) }));
jest.mock('./server-action', () => ({
  withServerActionDatabase: async (work: () => Promise<void>) => work(),
}));

import { runPlatformControlMutation } from './platform-control-mutation';

describe('Platform Control mutation failure references', () => {
  beforeEach(() => {
    mockRedirect.mockClear();
  });

  it('shows a safe reference and logs the same reference for a failed action', async () => {
    const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(runPlatformControlMutation({
      path: '/ops/mkety/platform-control/ai-operations',
      action: 'savePublicAiProviderConnection',
      work: async () => {
        throw new Error('database operation failed: postgres://user:password@host/secret');
      },
    })).rejects.toThrow(/^REDIRECT:/);

    const redirectLocation = mockRedirect.mock.calls[0]?.[0];
    expect(redirectLocation).toBeDefined();
    const url = new URL(redirectLocation!, 'https://mkety.test');
    const reference = url.searchParams.get('adminReference');
    expect(reference).toMatch(/^[0-9a-f-]{36}$/i);
    expect(url.searchParams.get('adminMessage')).not.toContain('postgres://');
    expect(url.searchParams.get('adminMessage')).not.toContain('password');
    expect(log).toHaveBeenCalledWith(
      `[platform-control:savePublicAiProviderConnection:${reference}]`,
      expect.objectContaining({ errorName: 'Error' }),
    );
    expect(JSON.stringify(log.mock.calls[0]?.[1])).not.toContain('postgres://');
    expect(JSON.stringify(log.mock.calls[0]?.[1])).not.toContain('password');
  });
});

import { enableRootEmailRoutingAfterCatchAll } from './mail-cutover-cloudflare';

describe('root mail Cloudflare activation sequence', () => {
  test('verifies the one Worker catch-all before making recipient resolution live and changing DNS', async () => {
    const calls: string[] = [];
    await enableRootEmailRoutingAfterCatchAll('zone-1', {
      setWorkerCatchAll: async () => { calls.push('set-catch-all'); },
      readCatchAll: async () => {
        calls.push('read-catch-all');
        return { enabled: true, actions: [{ type: 'worker', value: ['mkety-mail-ingress'] }] };
      },
      enableRecipientResolver: async () => { calls.push('enable-resolver'); },
      enableRootEmailRouting: async () => { calls.push('enable-root-dns'); },
    });
    expect(calls).toEqual(['set-catch-all', 'read-catch-all', 'enable-resolver', 'enable-root-dns']);
  });

  test('does not activate recipient resolution or DNS if catch-all readback fails', async () => {
    const enableRecipientResolver = jest.fn();
    const enableRootEmailRouting = jest.fn();
    await expect(enableRootEmailRoutingAfterCatchAll('zone-1', {
      setWorkerCatchAll: async () => undefined,
      readCatchAll: async () => ({ enabled: true, actions: [{ type: 'forward', value: ['hello@example.net'] }] }),
      enableRecipientResolver,
      enableRootEmailRouting,
    })).rejects.toThrow('mail_catch_all_unverified');
    expect(enableRecipientResolver).not.toHaveBeenCalled();
    expect(enableRootEmailRouting).not.toHaveBeenCalled();
  });
});

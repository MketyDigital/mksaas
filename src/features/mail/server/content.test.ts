jest.mock('./runtime-config', () => ({ getMailInternalSecret: () => 'test-internal-secret' }));

import { storeMailContent } from './content';

describe('storeMailContent', () => {
  const originalUrl = process.env.MKETY_MAIL_CONTENT_URL;
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.MKETY_MAIL_CONTENT_URL = 'https://mail-content.example.test';
  });

  afterEach(() => {
    if (originalUrl === undefined) delete process.env.MKETY_MAIL_CONTENT_URL;
    else process.env.MKETY_MAIL_CONTENT_URL = originalUrl;
    global.fetch = originalFetch;
  });

  it('preserves only the storage response status for safe archive diagnostics', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 401 } as Response);

    await expect(
      storeMailContent('mail/archive-staging/tenant/upload/0/0', new Uint8Array([1, 2, 3])),
    ).rejects.toMatchObject({
      message: 'Mkety Mail content storage rejected the migration object.',
      status: 401,
    });
  });
});

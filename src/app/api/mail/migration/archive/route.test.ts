/** @jest-environment node */

jest.mock('@/features/mail/server/archive-import-service', () => ({
  requireMailArchiveImportAccess: jest.fn().mockResolvedValue({ tenant: { id: 'tenant-1' } }),
}));

jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));

import { requireMailArchiveImportAccess } from '@/features/mail/server/archive-import-service';

import { POST } from './route';

const requireArchiveAccess = requireMailArchiveImportAccess as jest.Mock;

describe('POST /api/mail/migration/archive', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    requireArchiveAccess.mockResolvedValue({ tenant: { id: 'tenant-1' } });
  });

  it('retires the synchronous multipart path and redirects to the resumable uploader', async () => {
    const form = new FormData();
    form.set('mailboxId', 'mailbox-hello');
    form.append('files', new File(['Subject: hello\r\n\r\nBody'], 'hello.zip'));
    const request = new Request('https://app.mkety.com/api/mail/migration/archive?tenant=mkety-ops', {
      method: 'POST',
      headers: { origin: 'https://app.mkety.com' },
      body: form,
    });

    const response = await POST(request);

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe(
      'https://app.mkety.com/app/mkety-ops/mail/migration?error=upload-version',
    );
    expect(requireArchiveAccess).toHaveBeenCalledWith('mkety-ops');
  });

  it('rejects cross-origin uploads before parsing or importing them', async () => {
    const form = new FormData();
    form.set('mailboxId', 'mailbox-hello');
    const request = new Request('https://app.mkety.com/api/mail/migration/archive?tenant=mkety-ops', {
      method: 'POST',
      headers: { origin: 'https://attacker.example' },
      body: form,
    });

    const response = await POST(request);

    expect(response.status).toBe(403);
  });

  it('rejects uploads without an Origin header', async () => {
    const request = new Request('https://app.mkety.com/api/mail/migration/archive?tenant=mkety-ops', {
      method: 'POST',
      body: new FormData(),
    });

    const response = await POST(request);

    expect(response.status).toBe(403);
  });

  it('authorizes before redirecting an obsolete upload request', async () => {
    requireArchiveAccess.mockRejectedValue(new Error('redirect:/login'));
    const form = new FormData();
    form.set('mailboxId', 'mailbox-hello');
    const request = new Request('https://app.mkety.com/api/mail/migration/archive?tenant=mkety-ops', {
      method: 'POST',
      headers: { origin: 'https://app.mkety.com' },
      body: form,
    });
    await expect(POST(request)).rejects.toThrow('redirect:/login');
  });
});

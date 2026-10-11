/** @jest-environment node */

jest.mock('@/features/mail/server/archive-import-service', () => ({
  importMailArchive: jest.fn(),
  requireMailArchiveImportAccess: jest.fn().mockResolvedValue({ tenant: { id: 'tenant-1' } }),
  SAFE_ARCHIVE_ERRORS: ['files', 'type', 'size', 'mailbox', 'workspace'],
  MAX_ARCHIVE_UPLOAD_BYTES: 25_000_000,
  MailArchiveImportError: class MailArchiveImportError extends Error {
    code: string;
    constructor(code: string) { super(code); this.code = code; }
  },
}));

jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));

import { importMailArchive, requireMailArchiveImportAccess } from '@/features/mail/server/archive-import-service';

import { POST } from './route';

const importArchive = importMailArchive as jest.Mock;
const requireArchiveAccess = requireMailArchiveImportAccess as jest.Mock;

describe('POST /api/mail/migration/archive', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    importArchive.mockReset();
    requireArchiveAccess.mockResolvedValue({ tenant: { id: 'tenant-1' } });
  });

  it('accepts a same-origin multipart upload and redirects with the import result', async () => {
    importArchive.mockResolvedValue({ runId: 'run-1', imported: 12, skipped: 1, failed: 0 });
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
      'https://app.mkety.com/app/mkety-ops/mail/migration?imported=12&run=run-1',
    );
    expect(importArchive).toHaveBeenCalledWith(
      'mkety-ops',
      expect.any(FormData),
      expect.objectContaining({ tenant: { id: 'tenant-1' } }),
    );
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
    expect(importArchive).not.toHaveBeenCalled();
  });

  it('rejects uploads without an Origin header', async () => {
    const request = new Request('https://app.mkety.com/api/mail/migration/archive?tenant=mkety-ops', {
      method: 'POST',
      body: new FormData(),
    });

    const response = await POST(request);

    expect(response.status).toBe(403);
    expect(importArchive).not.toHaveBeenCalled();
  });

  it('authorizes before parsing an upload body', async () => {
    requireArchiveAccess.mockRejectedValue(new Error('redirect:/login'));
    const form = new FormData();
    form.set('mailboxId', 'mailbox-hello');
    const request = new Request('https://app.mkety.com/api/mail/migration/archive?tenant=mkety-ops', {
      method: 'POST',
      headers: { origin: 'https://app.mkety.com' },
      body: form,
    });
    const parseBody = jest.spyOn(request, 'formData');

    await expect(POST(request)).rejects.toThrow('redirect:/login');

    expect(parseBody).not.toHaveBeenCalled();
    expect(importArchive).not.toHaveBeenCalled();
  });

  it('rejects oversized multipart requests before authorization or parsing', async () => {
    const parseBody = jest.fn();
    const request = {
      url: 'https://app.mkety.com/api/mail/migration/archive?tenant=mkety-ops',
      headers: new Headers({
        origin: 'https://app.mkety.com',
        'content-length': String(25_256_001),
      }),
      formData: parseBody,
    } as unknown as Request;

    const response = await POST(request);

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe(
      'https://app.mkety.com/app/mkety-ops/mail/migration?error=size',
    );
    expect(requireArchiveAccess).not.toHaveBeenCalled();
    expect(parseBody).not.toHaveBeenCalled();
  });

  it('redirects with a safe validation code from the importer', async () => {
    importArchive.mockRejectedValue(Object.assign(new Error('archive_size_limit'), { code: 'size' }));
    const form = new FormData();
    const request = new Request('https://app.mkety.com/api/mail/migration/archive?tenant=mkety-ops', {
      method: 'POST',
      headers: { origin: 'https://app.mkety.com' },
      body: form,
    });

    const response = await POST(request);

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe(
      'https://app.mkety.com/app/mkety-ops/mail/migration?error=size',
    );
  });
});

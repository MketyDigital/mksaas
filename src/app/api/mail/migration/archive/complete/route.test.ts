/** @jest-environment node */

jest.mock('@/features/mail/server/archive-import-service', () => ({
  completeMailArchiveUpload: jest.fn().mockResolvedValue({ runId: '12345678-1234-1234-1234-123456789012', total: 354 }),
  MailArchiveImportError: class MailArchiveImportError extends Error {
    code: string;
    constructor(code: string) {
      super(code);
      this.code = code;
    }
  },
  requireMailArchiveImportAccess: jest.fn().mockResolvedValue({ tenant: { id: 'tenant-1' } }),
  SAFE_ARCHIVE_ERRORS: ['files', 'type', 'size', 'mailbox', 'workspace'],
}));

import {
  completeMailArchiveUpload,
  requireMailArchiveImportAccess,
} from '@/features/mail/server/archive-import-service';

import { POST } from './route';

describe('POST /api/mail/migration/archive/complete', () => {
  beforeEach(() => jest.clearAllMocks());

  it('authorizes and queues a validated upload manifest', async () => {
    const request = new Request('https://app.mkety.com/api/mail/migration/archive/complete?tenant=mkety-ops', {
      method: 'POST',
      headers: { origin: 'https://app.mkety.com', 'content-type': 'application/json' },
      body: JSON.stringify({
        mailboxId: 'mailbox-hello',
        uploadId: '12345678-1234-1234-1234-123456789012',
        files: [{ name: 'hello.zip', size: 8_736_331, chunks: 35 }],
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(requireMailArchiveImportAccess).toHaveBeenCalledWith('mkety-ops');
    expect(completeMailArchiveUpload).toHaveBeenCalledWith(
      'mkety-ops',
      {
        mailboxId: 'mailbox-hello',
        uploadId: '12345678-1234-1234-1234-123456789012',
        files: [{ name: 'hello.zip', size: 8_736_331, chunks: 35 }],
      },
      expect.objectContaining({ tenant: { id: 'tenant-1' } }),
    );
    await expect(response.json()).resolves.toEqual({ runId: '12345678-1234-1234-1234-123456789012', total: 354 });
  });

  it('rejects a cross-origin finalize request before checking the manifest', async () => {
    const request = new Request('https://app.mkety.com/api/mail/migration/archive/complete?tenant=mkety-ops', {
      method: 'POST',
      headers: { origin: 'https://attacker.example' },
      body: '{}',
    });

    const response = await POST(request);

    expect(response.status).toBe(403);
    expect(requireMailArchiveImportAccess).not.toHaveBeenCalled();
    expect(completeMailArchiveUpload).not.toHaveBeenCalled();
  });
});

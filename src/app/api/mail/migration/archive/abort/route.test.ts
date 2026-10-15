/** @jest-environment node */

jest.mock('@/features/mail/server/archive-import-service', () => ({
  archiveUploadChunkKey: jest.fn(
    (tenant: string, upload: string, file: number, chunk: number) =>
      `mail/archive-staging/${tenant}/${upload}/${file}/${chunk}`,
  ),
  MAX_ARCHIVE_UPLOAD_CHUNKS: 40,
  requireMailArchiveImportAccess: jest.fn().mockResolvedValue({ tenant: { id: 'tenant-1' } }),
}));

jest.mock('@/features/mail/server/content', () => ({ deleteMailContent: jest.fn().mockResolvedValue(undefined) }));

const mockWithRequestDatabase = jest.fn((work: () => Promise<unknown>) => work());
jest.mock('@/shared/db/request', () => ({
  withRequestDatabase: (work: () => Promise<unknown>) => mockWithRequestDatabase(work),
}));

import { requireMailArchiveImportAccess } from '@/features/mail/server/archive-import-service';

import { POST } from './route';

describe('POST /api/mail/migration/archive/abort', () => {
  beforeEach(() => jest.clearAllMocks());

  it('authorizes cleanup inside a request-scoped database context', async () => {
    const request = new Request('https://app.mkety.com/api/mail/migration/archive/abort?tenant=mkety-ops', {
      method: 'POST',
      headers: { origin: 'https://app.mkety.com', 'content-type': 'application/json' },
      body: JSON.stringify({ uploadId: '12345678-1234-1234-1234-123456789012', files: [{ chunks: 1 }] }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(mockWithRequestDatabase).toHaveBeenCalledTimes(1);
    expect(requireMailArchiveImportAccess).toHaveBeenCalledWith('mkety-ops');
    expect(mockWithRequestDatabase.mock.invocationCallOrder[0]).toBeLessThan(
      jest.mocked(requireMailArchiveImportAccess).mock.invocationCallOrder[0],
    );
  });
});

/** @jest-environment node */

jest.mock('@/features/mail/server/archive-import-service', () => ({
  archiveUploadChunkKey: jest.fn(
    (tenant: string, upload: string, file: number, chunk: number) =>
      `mail/archive-staging/${tenant}/${upload}/${file}/${chunk}`,
  ),
  MAX_ARCHIVE_CHUNK_BYTES: 256_000,
  MAX_ARCHIVE_UPLOAD_CHUNKS: 40,
  requireMailArchiveImportAccess: jest.fn().mockResolvedValue({ tenant: { id: 'tenant-1' } }),
}));

jest.mock('@/features/mail/server/content', () => ({ storeMailContent: jest.fn().mockResolvedValue({ ok: true }) }));

const mockWithRequestDatabase = jest.fn((work: () => Promise<unknown>) => work());
jest.mock('@/shared/db/request', () => ({
  withRequestDatabase: (work: () => Promise<unknown>) => mockWithRequestDatabase(work),
}));

import { requireMailArchiveImportAccess } from '@/features/mail/server/archive-import-service';
import { storeMailContent } from '@/features/mail/server/content';

import { POST } from './route';

describe('POST /api/mail/migration/archive/chunk', () => {
  beforeEach(() => jest.clearAllMocks());

  it('accepts a bounded same-origin chunk after authorizing the manager', async () => {
    const request = new Request(
      'https://app.mkety.com/api/mail/migration/archive/chunk?tenant=mkety-ops&uploadId=12345678-1234-1234-1234-123456789012&fileIndex=0&chunkIndex=0',
      {
        method: 'POST',
        headers: { origin: 'https://app.mkety.com', 'content-type': 'application/octet-stream' },
        body: new Uint8Array([1, 2, 3]),
      },
    );

    const response = await POST(request);

    expect(response.status).toBe(201);
    expect(mockWithRequestDatabase).toHaveBeenCalledTimes(1);
    expect(requireMailArchiveImportAccess).toHaveBeenCalledWith('mkety-ops');
    expect(mockWithRequestDatabase.mock.invocationCallOrder[0]).toBeLessThan(
      jest.mocked(requireMailArchiveImportAccess).mock.invocationCallOrder[0],
    );
    expect(storeMailContent).toHaveBeenCalledWith(
      'mail/archive-staging/tenant-1/12345678-1234-1234-1234-123456789012/0/0',
      expect.any(Uint8Array),
      'application/octet-stream',
    );
  });

  it('rejects cross-origin chunk uploads without reading or storing the body', async () => {
    const request = new Request(
      'https://app.mkety.com/api/mail/migration/archive/chunk?tenant=mkety-ops&uploadId=12345678-1234-1234-1234-123456789012&fileIndex=0&chunkIndex=0',
      {
        method: 'POST',
        headers: { origin: 'https://attacker.example' },
        body: new Uint8Array([1]),
      },
    );

    const response = await POST(request);

    expect(response.status).toBe(403);
    expect(mockWithRequestDatabase).not.toHaveBeenCalled();
    expect(requireMailArchiveImportAccess).not.toHaveBeenCalled();
    expect(storeMailContent).not.toHaveBeenCalled();
  });

  it('rejects a chunk over the declared bound before parsing it', async () => {
    const request = {
      url: 'https://app.mkety.com/api/mail/migration/archive/chunk?tenant=mkety-ops&uploadId=12345678-1234-1234-1234-123456789012&fileIndex=0&chunkIndex=0',
      headers: new Headers({ origin: 'https://app.mkety.com', 'content-length': '256001' }),
      body: null,
    } as unknown as Request;

    const response = await POST(request);

    expect(response.status).toBe(413);
    expect(storeMailContent).not.toHaveBeenCalled();
  });
});

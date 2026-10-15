/** @jest-environment node */

jest.mock('@/features/mail/server/archive-import-service', () => ({
  requireMailArchiveImportAccess: jest.fn().mockResolvedValue({ tenant: { id: 'tenant-1' } }),
}));

const mockWithRequestDatabase = jest.fn((work: () => Promise<unknown>) => work());
jest.mock('@/shared/db/request', () => ({
  withRequestDatabase: (work: () => Promise<unknown>) => mockWithRequestDatabase(work),
}));

import { requireMailArchiveImportAccess } from '@/features/mail/server/archive-import-service';

import { POST } from './route';

describe('POST /api/mail/migration/archive', () => {
  beforeEach(() => jest.clearAllMocks());

  it('checks access inside a request-scoped database context', async () => {
    const request = new Request('https://app.mkety.com/api/mail/migration/archive?tenant=mkety-ops', {
      method: 'POST',
      headers: { origin: 'https://app.mkety.com' },
    });

    const response = await POST(request);

    expect(response.status).toBe(303);
    expect(mockWithRequestDatabase).toHaveBeenCalledTimes(1);
    expect(requireMailArchiveImportAccess).toHaveBeenCalledWith('mkety-ops');
    expect(mockWithRequestDatabase.mock.invocationCallOrder[0]).toBeLessThan(
      jest.mocked(requireMailArchiveImportAccess).mock.invocationCallOrder[0],
    );
  });
});

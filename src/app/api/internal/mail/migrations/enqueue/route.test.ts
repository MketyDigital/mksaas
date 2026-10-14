/** @jest-environment node */

jest.mock('@/features/mail/server/cloudflare', () => ({
  publishMailMigrationQueue: jest.fn().mockResolvedValue({ ok: true }),
}));
jest.mock('@/features/mail/server/runtime-config', () => ({
  getMailInternalSecret: jest.fn(() => 'internal-test-secret'),
}));
jest.mock('@/shared/db/cloudflare', () => ({ db: { query: { mailMigrationRuns: { findFirst: jest.fn() } } } }));
jest.mock('@/shared/db/request', () => ({ withRequestDatabase: (work: () => unknown) => work() }));

import { publishMailMigrationQueue } from '@/features/mail/server/cloudflare';
import { db } from '@/shared/db/cloudflare';

import { POST } from './route';

const findRun = db.query.mailMigrationRuns.findFirst as jest.Mock;

describe('POST /api/internal/mail/migrations/enqueue', () => {
  beforeEach(() => jest.clearAllMocks());

  it('publishes only a queued archive run when called with the internal secret', async () => {
    findRun.mockResolvedValue({ id: '12345678-1234-1234-1234-123456789012', sourceType: 'archive', status: 'queued' });
    const request = new Request('https://api.mkety.com/api/internal/mail/migrations/enqueue', {
      method: 'POST',
      headers: { authorization: 'Bearer internal-test-secret', 'content-type': 'application/json' },
      body: JSON.stringify({ runId: '12345678-1234-1234-1234-123456789012', kind: 'archive' }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(publishMailMigrationQueue).toHaveBeenCalledWith('12345678-1234-1234-1234-123456789012', 'archive');
  });

  it('rejects requests without the internal secret before reading the database', async () => {
    const request = new Request('https://api.mkety.com/api/internal/mail/migrations/enqueue', {
      method: 'POST',
      headers: { authorization: 'Bearer wrong' },
      body: '{}',
    });

    const response = await POST(request);

    expect(response.status).toBe(401);
    expect(findRun).not.toHaveBeenCalled();
    expect(publishMailMigrationQueue).not.toHaveBeenCalled();
  });
});

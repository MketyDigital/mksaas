/** @jest-environment node */

const firstDb = { request: 1 };
const secondDb = { request: 2 };
const databaseQueue = [firstDb, secondDb];
const mockWithRequestDatabase = jest.fn(async (work: (database: object) => Promise<unknown>) => {
  const database = databaseQueue.shift();
  if (!database) throw new Error('No request database fixture remains.');
  const { runWithRequestDatabaseContext } = await import('@/shared/db/request-context');
  return runWithRequestDatabaseContext(database, () => work(database));
});
const mockPostgres = jest.fn(() => ({ end: jest.fn().mockResolvedValue(undefined) }));
const mockDrizzle = jest.fn(() => ({ legacy: true }));

jest.mock('@/shared/db/request', () => ({
  withRequestDatabase: (work: (database: object) => Promise<unknown>) => mockWithRequestDatabase(work),
}));
jest.mock('postgres', () => ({ __esModule: true, default: () => mockPostgres() }));
jest.mock('drizzle-orm/postgres-js', () => ({ drizzle: () => mockDrizzle() }));
jest.mock('@/shared/db/runtime-connection.cloudflare', () => ({
  getRuntimeDatabaseConnectionString: () => 'postgresql://runtime.example/mkety',
}));
jest.mock('@/shared/db/schema', () => ({}));

import { getRequestDatabaseContext } from '@/shared/db/request-context';
import { withPublicAIRequestDatabase } from './request-database';

describe('Public Mkety AI request database lifecycle', () => {
  beforeEach(() => {
    databaseQueue.splice(0, databaseQueue.length, firstDb, secondDb);
    mockWithRequestDatabase.mockClear();
    mockPostgres.mockClear();
    mockDrizzle.mockClear();
  });

  it('uses the shared request database context for nested provider/config queries', async () => {
    const seen: Array<{ callbackDatabase: object; contextualDatabase: object | undefined }> = [];

    await withPublicAIRequestDatabase(async (database) => {
      seen.push({ callbackDatabase: database, contextualDatabase: getRequestDatabaseContext() });
    });
    await withPublicAIRequestDatabase(async (database) => {
      seen.push({ callbackDatabase: database, contextualDatabase: getRequestDatabaseContext() });
    });

    expect(seen).toEqual([
      { callbackDatabase: firstDb, contextualDatabase: firstDb },
      { callbackDatabase: secondDb, contextualDatabase: secondDb },
    ]);
    expect(mockWithRequestDatabase).toHaveBeenCalledTimes(2);
  });
});

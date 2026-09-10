/** @jest-environment node */

const firstEnd = jest.fn().mockResolvedValue(undefined);
const secondEnd = jest.fn().mockResolvedValue(undefined);
const firstClient = Object.assign(jest.fn(), { end: firstEnd });
const secondClient = Object.assign(jest.fn(), { end: secondEnd });
const mockPostgres = jest
  .fn()
  .mockReturnValueOnce(firstClient)
  .mockReturnValueOnce(secondClient);
const firstDb = { request: 1 };
const secondDb = { request: 2 };
const mockDrizzle = jest.fn().mockReturnValueOnce(firstDb).mockReturnValueOnce(secondDb);

jest.mock('postgres', () => ({
  __esModule: true,
  default: (...args: unknown[]) => mockPostgres(...args),
}));

jest.mock('drizzle-orm/postgres-js', () => ({
  drizzle: (...args: unknown[]) => mockDrizzle(...args),
}));

import { withPublicAIRequestDatabase } from './request-database';

describe('Public Mkety AI request database lifecycle', () => {
  beforeEach(() => {
    process.env.DATABASE_URL = 'postgresql://example.invalid/mkety';
  });

  it('uses a fresh database client for each request and closes it afterward', async () => {
    const seen: unknown[] = [];

    await withPublicAIRequestDatabase(async (database) => {
      seen.push(database);
    });
    await withPublicAIRequestDatabase(async (database) => {
      seen.push(database);
    });

    expect(seen).toEqual([firstDb, secondDb]);
    expect(mockPostgres).toHaveBeenCalledTimes(2);
    expect(firstEnd).toHaveBeenCalledTimes(1);
    expect(secondEnd).toHaveBeenCalledTimes(1);
  });
});

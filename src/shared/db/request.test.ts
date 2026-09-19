/** @jest-environment node */

const firstEnd = jest.fn().mockResolvedValue(undefined);
const secondEnd = jest.fn().mockResolvedValue(undefined);
const firstClient = Object.assign(jest.fn(), { end: firstEnd });
const secondClient = Object.assign(jest.fn(), { end: secondEnd });
const mockPostgres = jest.fn().mockReturnValueOnce(firstClient).mockReturnValueOnce(secondClient);
const firstDb = { request: 1 };
const secondDb = { request: 2 };
const mockDrizzle = jest.fn().mockReturnValueOnce(firstDb).mockReturnValueOnce(secondDb);
const mockRuntimeConnectionString = jest.fn().mockReturnValue('postgresql://runtime.example/mkety');

jest.mock('postgres', () => ({
  __esModule: true,
  default: (...args: unknown[]) => mockPostgres(...args),
}));

jest.mock('drizzle-orm/postgres-js', () => ({
  drizzle: (...args: unknown[]) => mockDrizzle(...args),
}));

jest.mock('./runtime-connection.cloudflare', () => ({
  getRuntimeDatabaseConnectionString: () => mockRuntimeConnectionString(),
}));

import { withRequestDatabase } from './request';

describe('Shared request database lifecycle', () => {
  it('uses the runtime connection resolver for each request and closes the client afterward', async () => {
    const seen: unknown[] = [];

    await withRequestDatabase(async (database) => {
      seen.push(database);
    });
    await withRequestDatabase(async (database) => {
      seen.push(database);
    });

    expect(seen).toEqual([firstDb, secondDb]);
    expect(mockRuntimeConnectionString).toHaveBeenCalledTimes(2);
    expect(mockPostgres).toHaveBeenNthCalledWith(1, 'postgresql://runtime.example/mkety', { max: 1, connect_timeout: 2, idle_timeout: 2 });
    expect(mockPostgres).toHaveBeenNthCalledWith(2, 'postgresql://runtime.example/mkety', { max: 1, connect_timeout: 2, idle_timeout: 2 });
    expect(firstEnd).toHaveBeenCalledWith({ timeout: 1 });
    expect(secondEnd).toHaveBeenCalledWith({ timeout: 1 });
  });

  it('closes the client even when request work throws', async () => {
    mockPostgres.mockReturnValueOnce(firstClient);
    mockDrizzle.mockReturnValueOnce(firstDb);

    await expect(
      withRequestDatabase(async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    expect(firstEnd).toHaveBeenCalled();
  });
});

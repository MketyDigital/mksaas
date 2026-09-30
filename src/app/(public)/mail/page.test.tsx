/** @jest-environment node */
import { getRequestDatabaseContext, runWithRequestDatabaseContext } from '@/shared/db/request-context';

const catalog = jest.fn();
jest.mock('@/features/billing/server/active-catalog', () => ({ getActiveSelfServicePlans: (...args: unknown[]) => catalog(...args) }));
let requestNumber = 0;
jest.mock('@/shared/db/request', () => ({
  withRequestDatabase: (work: (database: object) => Promise<unknown>) => {
    const database = { requestNumber: ++requestNumber };
    return runWithRequestDatabaseContext(database, () => work(database));
  },
}));

import MketyMailPublicPage from './page';

describe('public Mail catalog request lifecycle', () => {
  it('reads active Mail plans with a fresh database context for each page request', async () => {
    const databases: unknown[] = [];
    catalog.mockImplementation(async () => {
      const database = getRequestDatabaseContext();
      if (!database) throw new Error('Mail pricing read escaped its database request scope.');
      databases.push(database);
      return [];
    });
    await MketyMailPublicPage();
    await MketyMailPublicPage();
    expect(databases).toHaveLength(2);
    expect(databases[0]).not.toBe(databases[1]);
  });
});

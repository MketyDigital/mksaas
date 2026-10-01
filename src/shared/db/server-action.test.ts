/** @jest-environment node */
import { runWithRequestDatabaseContext } from './request-context';

const withRequestDatabaseMock = jest.fn(
  async (work: (database: object) => Promise<unknown>) => {
    const database = { request: Symbol('server-action-request') };
    return runWithRequestDatabaseContext(database, () => work(database));
  },
);

jest.mock('./request', () => ({
  withRequestDatabase: (work: (database: object) => Promise<unknown>) =>
    withRequestDatabaseMock(work),
}));

import { withServerActionDatabase } from './server-action';

describe('withServerActionDatabase', () => {
  beforeEach(() => {
    withRequestDatabaseMock.mockClear();
  });

  it('creates a fresh request database even when an older AsyncLocalStorage database is visible', async () => {
    const staleDatabase = { stale: true };
    let observed: unknown;

    await runWithRequestDatabaseContext(staleDatabase, async () => {
      await withServerActionDatabase(async () => {
        const { getRequestDatabaseContext } = await import('./request-context');
        observed = getRequestDatabaseContext();
      });
    });

    expect(withRequestDatabaseMock).toHaveBeenCalledTimes(1);
    expect(observed).not.toBe(staleDatabase);
  });

  it('creates a fresh request database for every Server Action invocation', async () => {
    const observed: unknown[] = [];
    const { getRequestDatabaseContext } = await import('./request-context');

    await withServerActionDatabase(async () => {
      observed.push(getRequestDatabaseContext());
    });
    await withServerActionDatabase(async () => {
      observed.push(getRequestDatabaseContext());
    });

    expect(withRequestDatabaseMock).toHaveBeenCalledTimes(2);
    expect(observed[0]).not.toBe(observed[1]);
  });
});

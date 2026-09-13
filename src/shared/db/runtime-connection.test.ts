/** @jest-environment node */

import { env } from 'cloudflare:workers';

import { getRuntimeDatabaseConnectionString } from './runtime-connection';

type TestEnv = {
  MKETY_DB?: { connectionString: string };
};

const testEnv = env as TestEnv;

describe('runtime database connection selection', () => {
  afterEach(() => {
    delete testEnv.MKETY_DB;
    delete process.env.DATABASE_URL;
  });

  it('uses the MKETY_DB Hyperdrive binding inside Cloudflare Workers', () => {
    process.env.DATABASE_URL = 'postgresql://direct.example/mkety';
    testEnv.MKETY_DB = { connectionString: 'postgresql://hyperdrive.internal/mkety' };

    expect(getRuntimeDatabaseConnectionString()).toBe('postgresql://hyperdrive.internal/mkety');
  });

  it('uses DATABASE_URL when no Hyperdrive binding exists', () => {
    process.env.DATABASE_URL = 'postgresql://direct.example/mkety';

    expect(getRuntimeDatabaseConnectionString()).toBe('postgresql://direct.example/mkety');
  });
});

/** @jest-environment node */

import { env } from 'cloudflare:workers';

import { getRuntimeDatabaseConnectionString as getCloudflareRuntimeDatabaseConnectionString } from './runtime-connection.cloudflare';
import { getRuntimeDatabaseConnectionString as getNodeRuntimeDatabaseConnectionString } from './runtime-connection';

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

    expect(getCloudflareRuntimeDatabaseConnectionString()).toBe('postgresql://hyperdrive.internal/mkety');
  });

  it('falls back to DATABASE_URL in Cloudflare when the binding is not configured', () => {
    process.env.DATABASE_URL = 'postgresql://direct.example/mkety';

    expect(getCloudflareRuntimeDatabaseConnectionString()).toBe('postgresql://direct.example/mkety');
  });

  it('uses DATABASE_URL in Node and Coolify execution', () => {
    process.env.DATABASE_URL = 'postgresql://direct.example/mkety';
    testEnv.MKETY_DB = { connectionString: 'postgresql://hyperdrive.internal/mkety' };

    expect(getNodeRuntimeDatabaseConnectionString()).toBe('postgresql://direct.example/mkety');
  });
});

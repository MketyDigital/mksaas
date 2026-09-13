/** @jest-environment node */

import { resolveDatabaseConnectionString } from './connection-string';

describe('database connection string resolution', () => {
  it('prefers a Cloudflare Hyperdrive connection string when one is supplied', () => {
    expect(
      resolveDatabaseConnectionString({
        databaseUrl: 'postgresql://local.example/mkety',
        hyperdriveConnectionString: 'postgresql://hyperdrive.internal/mkety',
      }),
    ).toBe('postgresql://hyperdrive.internal/mkety');
  });

  it('falls back to DATABASE_URL outside Cloudflare Worker runtime', () => {
    expect(
      resolveDatabaseConnectionString({
        databaseUrl: 'postgresql://local.example/mkety',
      }),
    ).toBe('postgresql://local.example/mkety');
  });

  it('fails closed when neither Hyperdrive nor DATABASE_URL is available', () => {
    expect(() => resolveDatabaseConnectionString({})).toThrow(
      'No database connection string is available',
    );
  });
});

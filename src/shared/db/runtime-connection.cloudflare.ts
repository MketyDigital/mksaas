import { env } from 'cloudflare:workers';

import { resolveDatabaseConnectionString } from './connection-string';

export const runtimeConnectionAdapterKind = 'cloudflare' as const;

export function getRuntimeDatabaseConnectionString(): string {
  return resolveDatabaseConnectionString({
    databaseUrl: process.env.DATABASE_URL,
    hyperdriveConnectionString: env.MKETY_DB?.connectionString,
  });
}

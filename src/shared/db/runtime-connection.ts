import { resolveDatabaseConnectionString } from './connection-string';

export const runtimeConnectionAdapterKind = 'node' as const;

export function getRuntimeDatabaseConnectionString(): string {
  return resolveDatabaseConnectionString({
    databaseUrl: process.env.DATABASE_URL,
  });
}

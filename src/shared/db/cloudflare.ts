import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import { getRuntimeDatabaseConnectionString } from './runtime-connection.cloudflare';
import * as schema from './schema';

const globalForCloudflareDb = globalThis as unknown as {
  cloudflareConn: postgres.Sql | undefined;
};

let connectionString: string | undefined;

try {
  connectionString = getRuntimeDatabaseConnectionString();
} catch (error) {
  if (!process.env.SKIP_ENV_VALIDATION) {
    throw error;
  }
}

const conn =
  globalForCloudflareDb.cloudflareConn ??
  postgres(connectionString ?? 'postgresql://localhost/placeholder', {
    max: connectionString ? undefined : 0,
  });

if (process.env.NODE_ENV !== 'production') {
  globalForCloudflareDb.cloudflareConn = conn;
}

export const db = drizzle(conn, { schema });
export type Database = typeof db;

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import { getRuntimeDatabaseConnectionString } from './runtime-connection';
import * as schema from './schema';

const globalForDb = globalThis as unknown as {
  nodeConn: postgres.Sql | undefined;
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
  globalForDb.nodeConn ??
  postgres(connectionString ?? 'postgresql://localhost/placeholder', {
    max: connectionString ? undefined : 0,
  });

if (process.env.NODE_ENV !== 'production') {
  globalForDb.nodeConn = conn;
}

export const db = drizzle(conn, { schema });
export type Database = typeof db;

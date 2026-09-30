import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import { getRuntimeDatabaseConnectionString } from '@/shared/db/runtime-connection.cloudflare';
import { runWithRequestDatabaseContext } from './request-context';
import * as schema from './schema';
import type { Database } from './index';

export async function withRequestDatabase<T>(work: (database: Database) => Promise<T>): Promise<T> {
  const connectionString = getRuntimeDatabaseConnectionString();
  const client = postgres(connectionString, { max: 1, prepare: false });
  const database = drizzle(client, { schema }) as Database;

  try {
    return await runWithRequestDatabaseContext(database as object, () => work(database));
  } finally {
    await client.end();
  }
}

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import type { Database } from './index';
import { getRuntimeDatabaseConnectionString } from './runtime-connection';
import * as schema from './schema';

export async function withRequestDatabase<T>(work: (database: Database) => Promise<T>): Promise<T> {
  const connectionString = getRuntimeDatabaseConnectionString();
  const client = postgres(connectionString, { max: 1 });
  const database = drizzle(client, { schema }) as Database;

  try {
    return await work(database);
  } finally {
    await client.end();
  }
}

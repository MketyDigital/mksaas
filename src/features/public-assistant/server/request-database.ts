import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import type { Database } from '@/shared/db';
import { getRuntimeDatabaseConnectionString } from '@/shared/db/runtime-connection.cloudflare';
import * as schema from '@/shared/db/schema';

export async function withPublicAIRequestDatabase<T>(work: (database: Database) => Promise<T>): Promise<T> {
  const connectionString = getRuntimeDatabaseConnectionString();
  const client = postgres(connectionString, { max: 1, connect_timeout: 2, idle_timeout: 2 });
  const database = drizzle(client, { schema }) as Database;

  try {
    return await work(database);
  } finally {
    await client.end({ timeout: 1 }).catch(() => {});
  }
}

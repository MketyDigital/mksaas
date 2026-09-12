import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import type { Database } from '@/shared/db';
import * as schema from '@/shared/db/schema';

export async function withPublicAIRequestDatabase<T>(work: (database: Database) => Promise<T>): Promise<T> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  const client = postgres(connectionString, { max: 1 });
  const database = drizzle(client, { schema }) as Database;

  try {
    return await work(database);
  } finally {
    await client.end();
  }
}

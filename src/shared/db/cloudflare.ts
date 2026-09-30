import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import { getRequestDatabaseContext } from './request-context';
import { getRuntimeDatabaseConnectionString } from './runtime-connection.cloudflare';
import * as schema from './schema';

function createCloudflareDatabase() {
  const connectionString = getRuntimeDatabaseConnectionString();
  const conn = postgres(connectionString, { max: 1, prepare: false });
  return drizzle(conn, { schema });
}

type CloudflareDatabase = ReturnType<typeof createCloudflareDatabase>;

let singletonDatabase: CloudflareDatabase | undefined;

export function getCloudflareDatabase(): CloudflareDatabase {
  singletonDatabase ??= createCloudflareDatabase();
  return singletonDatabase;
}

export const db = new Proxy({} as CloudflareDatabase, {
  get(_target, property) {
    const database = getRequestDatabaseContext<CloudflareDatabase>() ?? getCloudflareDatabase();
    const value = Reflect.get(database as object, property, database);

    return typeof value === 'function' ? value.bind(database) : value;
  },
});

export type Database = CloudflareDatabase;

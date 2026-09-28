import { AsyncLocalStorage } from 'node:async_hooks';

const requestDatabaseStorage = new AsyncLocalStorage<object>();

export function runWithRequestDatabaseContext<T>(
  database: object,
  work: () => Promise<T>,
): Promise<T> {
  return requestDatabaseStorage.run(database, work);
}

export function getRequestDatabaseContext<T extends object>(): T | undefined {
  return requestDatabaseStorage.getStore() as T | undefined;
}

import { withRequestDatabase } from './request';

/**
 * Ensures every top-level Server Action gets its own fresh Hyperdrive-safe
 * PostgreSQL client.
 *
 * A Server Action POST is a separate HTTP request from the page render that
 * produced the form. Never reuse an AsyncLocalStorage database context here:
 * in a long-lived Worker isolate that context may refer to a client whose
 * originating render has already completed and closed it.
 */
export async function withServerActionDatabase<T>(work: () => Promise<T>): Promise<T> {
  return withRequestDatabase(async () => work());
}

import { getRequestDatabaseContext } from './request-context';
import { withRequestDatabase } from './request';

/**
 * Ensures a Server Action gets a fresh Hyperdrive-safe database connection.
 *
 * Page render request context does not carry into a later Server Action POST.
 * Reuse an existing request DB when one is already present (for nested actions/tests);
 * otherwise create and close one for this action invocation.
 */
export async function withServerActionDatabase<T>(work: () => Promise<T>): Promise<T> {
  if (getRequestDatabaseContext<object>()) return work();
  return withRequestDatabase(async () => work());
}

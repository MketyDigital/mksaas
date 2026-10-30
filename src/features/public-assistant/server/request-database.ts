import { withRequestDatabase } from '@/shared/db/request';
import type { Database } from '@/shared/db';

export async function withPublicAIRequestDatabase<T>(work: (database: Database) => Promise<T>): Promise<T> {
  return withRequestDatabase(work);
}

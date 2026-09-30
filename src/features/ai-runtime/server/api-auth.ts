import { eq } from 'drizzle-orm';

import { db } from '@/shared/db/cloudflare';
import { aiApiKeys } from '@/shared/db/schema';
import { hashAiApiKey } from './api-keys';

export async function authenticateAiApiKey(request: Request, requiredScope?: string) {
  const authorization = request.headers.get('authorization') ?? '';
  const key = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!(key.startsWith('mk_ai_live_') || key.startsWith('mk_ai_test_')) || key.length < 40) return null;

  const keyHash = await hashAiApiKey(key);
  const row = await db.query.aiApiKeys.findFirst({ where: eq(aiApiKeys.keyHash, keyHash) });
  if (!row || row.revokedAt || (row.expiresAt && row.expiresAt.getTime() <= Date.now())) return null;
  if (requiredScope && !row.scopes.includes(requiredScope)) return null;

  await db.update(aiApiKeys).set({ lastUsedAt: new Date() }).where(eq(aiApiKeys.id, row.id));
  return row;
}

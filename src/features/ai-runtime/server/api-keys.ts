import { and, eq } from 'drizzle-orm';

import { db } from '@/shared/db/cloudflare';
import { aiApiKeys } from '@/shared/db/schema';

const encoder = new TextEncoder();

function toHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function hashAiApiKey(value: string) {
  return toHex(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))));
}

function randomToken(bytes = 32) {
  const value = new Uint8Array(bytes);
  crypto.getRandomValues(value);
  return toHex(value);
}

export async function createAiApiKey(input: {
  tenantId: string;
  projectId?: string | null;
  name: string;
  environment?: 'live' | 'test';
  scopes?: string[];
  expiresAt?: Date | null;
  createdByUserId?: string | null;
}) {
  const environment = input.environment ?? 'live';
  const prefix = environment === 'test' ? 'mk_ai_test_' : 'mk_ai_live_';
  const plaintext = prefix + randomToken();
  const keyHash = await hashAiApiKey(plaintext);
  const keyPrefix = plaintext.slice(0, Math.min(24, plaintext.length));

  const [row] = await db.insert(aiApiKeys).values({
    tenantId: input.tenantId,
    projectId: input.projectId ?? null,
    environment,
    name: input.name,
    keyPrefix,
    keyHash,
    scopes: input.scopes ?? ['ai:models:read', 'ai:chat'],
    expiresAt: input.expiresAt ?? null,
    createdByUserId: input.createdByUserId ?? null,
  }).returning();

  return { apiKey: plaintext, record: row };
}

export async function revokeAiApiKey(input: { tenantId: string; apiKeyId: string }) {
  const [row] = await db.update(aiApiKeys)
    .set({ revokedAt: new Date() })
    .where(and(eq(aiApiKeys.id, input.apiKeyId), eq(aiApiKeys.tenantId, input.tenantId)))
    .returning();
  return row ?? null;
}

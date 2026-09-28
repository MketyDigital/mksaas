import { and, eq } from 'drizzle-orm';

import { db } from '@/shared/db/cloudflare';
import { aiApiKeys, projects } from '@/shared/db/schema';

const encoder = new TextEncoder();

export const AI_API_SCOPES = ['ai:models:read', 'ai:chat'] as const;
export type AiApiScope = (typeof AI_API_SCOPES)[number];

const AI_API_SCOPE_SET = new Set<string>(AI_API_SCOPES);

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

export function normalizeAiApiScopes(scopes?: string[]): AiApiScope[] {
  const requested = scopes ?? [...AI_API_SCOPES];
  if (requested.length === 0) throw new Error('AI API keys require at least one scope.');

  const normalized = [...new Set(requested)];
  if (normalized.some((scope) => !AI_API_SCOPE_SET.has(scope))) {
    throw new Error('AI API key contains an unsupported scope.');
  }
  return normalized as AiApiScope[];
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
  const projectId = input.projectId ?? null;
  if (projectId) {
    const ownedProject = await db.query.projects.findFirst({
      where: and(eq(projects.id, projectId), eq(projects.tenantId, input.tenantId)),
      columns: { id: true },
    });
    if (!ownedProject) throw new Error('AI API key project is not available to this tenant.');
  }

  const environment = input.environment ?? 'live';
  const prefix = environment === 'test' ? 'mk_ai_test_' : 'mk_ai_live_';
  const plaintext = prefix + randomToken();
  const keyHash = await hashAiApiKey(plaintext);
  const keyPrefix = plaintext.slice(0, Math.min(24, plaintext.length));

  const [row] = await db.insert(aiApiKeys).values({
    tenantId: input.tenantId,
    projectId,
    environment,
    name: input.name,
    keyPrefix,
    keyHash,
    scopes: normalizeAiApiScopes(input.scopes),
    expiresAt: input.expiresAt ?? null,
    createdByUserId: input.createdByUserId ?? null,
  }).returning();

  if (!row) throw new Error('AI API key creation did not return a record.');
  return { apiKey: plaintext, record: row };
}

export async function revokeAiApiKey(input: { tenantId: string; apiKeyId: string }) {
  const [row] = await db.update(aiApiKeys)
    .set({ revokedAt: new Date() })
    .where(and(eq(aiApiKeys.id, input.apiKeyId), eq(aiApiKeys.tenantId, input.tenantId)))
    .returning();
  return row ?? null;
}

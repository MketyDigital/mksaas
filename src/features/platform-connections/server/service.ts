import { and, eq } from 'drizzle-orm';

import { db } from '@/shared/db/cloudflare';
import { platformServiceConnections } from '@/shared/db/schema';
import {
  decryptConnectionSecret,
  encryptConnectionSecret,
} from '@/shared/security/connection-secrets';

export type PlatformServiceConnectionMode = 'ote' | 'production';

export async function savePlatformServiceConnection(input: {
  serviceKey: string;
  providerKey: string;
  mode: PlatformServiceConnectionMode;
  secret: Record<string, string>;
  endpointUrl?: string | null;
  config?: Record<string, unknown>;
  actorUserId?: string | null;
  exclusiveProviderModes?: boolean;
}) {
  const serviceKey = input.serviceKey.trim();
  const providerKey = input.providerKey.trim();
  if (!serviceKey || !providerKey) throw new Error('Service and provider keys are required.');

  const secretRef = await encryptConnectionSecret(input.secret);
  const now = new Date();

  return db.transaction(async (tx) => {
    if (input.exclusiveProviderModes !== false) {
      await tx.update(platformServiceConnections).set({
        status: 'disabled',
        updatedByUserId: input.actorUserId ?? null,
        updatedAt: now,
      }).where(and(
        eq(platformServiceConnections.serviceKey, serviceKey),
        eq(platformServiceConnections.providerKey, providerKey),
      ));
    }

    const existing = await tx.query.platformServiceConnections.findFirst({
      where: and(
        eq(platformServiceConnections.serviceKey, serviceKey),
        eq(platformServiceConnections.providerKey, providerKey),
        eq(platformServiceConnections.mode, input.mode),
      ),
    });

    if (existing) {
      const [updated] = await tx.update(platformServiceConnections).set({
        secretRef,
        endpointUrl: input.endpointUrl?.trim() || null,
        config: input.config ?? {},
        status: 'active',
        updatedByUserId: input.actorUserId ?? null,
        updatedAt: now,
      }).where(eq(platformServiceConnections.id, existing.id)).returning();
      return updated ?? existing;
    }

    const [created] = await tx.insert(platformServiceConnections).values({
      serviceKey,
      providerKey,
      mode: input.mode,
      secretRef,
      endpointUrl: input.endpointUrl?.trim() || null,
      config: input.config ?? {},
      status: 'active',
      createdByUserId: input.actorUserId ?? null,
      updatedByUserId: input.actorUserId ?? null,
      updatedAt: now,
    }).returning();

    if (!created) throw new Error('Platform service connection creation did not return a record.');
    return created;
  });
}

export async function getActivePlatformServiceConnection(input: {
  serviceKey: string;
  providerKey: string;
}) {
  const row = await db.query.platformServiceConnections.findFirst({
    where: and(
      eq(platformServiceConnections.serviceKey, input.serviceKey),
      eq(platformServiceConnections.providerKey, input.providerKey),
      eq(platformServiceConnections.status, 'active'),
    ),
  });
  if (!row) return null;
  if (!row.secretRef) throw new Error('Platform service credential is missing.');

  return {
    ...row,
    secret: await decryptConnectionSecret(row.secretRef),
  };
}

export async function listPlatformServiceConnections(serviceKey: string) {
  return db.query.platformServiceConnections.findMany({
    where: eq(platformServiceConnections.serviceKey, serviceKey),
    columns: {
      id: true,
      serviceKey: true,
      providerKey: true,
      mode: true,
      endpointUrl: true,
      status: true,
      config: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function disablePlatformServiceConnection(input: {
  id: string;
  actorUserId?: string | null;
}) {
  const [row] = await db.update(platformServiceConnections).set({
    status: 'disabled',
    updatedByUserId: input.actorUserId ?? null,
    updatedAt: new Date(),
  }).where(eq(platformServiceConnections.id, input.id)).returning();
  return row ?? null;
}

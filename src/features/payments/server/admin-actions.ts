'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

import { requirePlatformControlAccess } from '@/features/platform-content/server/authorization';
import { db } from '@/shared/db/cloudflare';
import {
  platformAppControlCenterModules,
  platformAppExperienceRevisions,
} from '@/shared/db/schema/platform-app-experience';
import { requirePermission } from '@/shared/lib/permissions';

import {
  MKETY_FLUTTERWAVE_COLLECTION_CURRENCIES,
  normalizeMketyPaymentSettings,
} from '../config';

export async function updateMketyPaymentSettings(tenantSlug: string, formData: FormData): Promise<void> {
  const actor = await requirePlatformControlAccess(tenantSlug);
  await requirePermission(tenantSlug, 'platform:billing');

  const existing = await db.query.platformAppControlCenterModules.findFirst({
    where: eq(platformAppControlCenterModules.moduleKey, 'payments'),
  });
  if (!existing) throw new Error('Payments control module is not initialized.');

  const fxRates: Record<string, string> = {};
  for (const currency of MKETY_FLUTTERWAVE_COLLECTION_CURRENCIES) {
    if (currency === 'USD') continue;
    const raw = String(formData.get(`fx_${currency}`) ?? '').trim();
    if (!raw) continue;
    if (!/^\d+(?:\.\d{1,8})?$/.test(raw) || Number(raw) <= 0) {
      throw new Error(`Invalid ${currency} FX rate.`);
    }
    fxRates[currency] = raw;
  }

  const markupRaw = String(formData.get('flutterwave_fx_markup_bps') ?? '0').trim();
  const fxMarkupBps = Number(markupRaw);
  if (!Number.isInteger(fxMarkupBps) || fxMarkupBps < 0 || fxMarkupBps > 5000) {
    throw new Error('Flutterwave FX markup must be between 0 and 5000 basis points.');
  }

  const currentMetadata =
    existing.metadataJson && typeof existing.metadataJson === 'object' && !Array.isArray(existing.metadataJson)
      ? (existing.metadataJson as Record<string, unknown>)
      : {};
  const beforePaymentConfig = normalizeMketyPaymentSettings(currentMetadata.paymentConfig);
  const paymentConfig = normalizeMketyPaymentSettings({
    flutterwave: { fxRates, fxMarkupBps },
  });
  const nextMetadata = {
    ...currentMetadata,
    paymentConfig,
  };

  await db.transaction(async (tx) => {
    await tx
      .update(platformAppControlCenterModules)
      .set({
        metadataJson: nextMetadata,
        updatedBy: actor.userId,
        updatedAt: new Date(),
      })
      .where(eq(platformAppControlCenterModules.id, existing.id));

    await tx.insert(platformAppExperienceRevisions).values({
      entityType: 'control_center_module',
      entityId: existing.id,
      beforeJson: { paymentConfig: beforePaymentConfig },
      afterJson: { paymentConfig },
      actorId: actor.userId,
    });
  });

  revalidatePath(`/t/${tenantSlug}/admin/platform-control/payments`);
}

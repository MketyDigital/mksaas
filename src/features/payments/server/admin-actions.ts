'use server';

import { revalidatePath } from 'next/cache';

import { saveMketyPaymentSettings } from '@/features/payments/settings';
import { requirePlatformControlAccess } from '@/features/platform-content/server/authorization';
import { requirePermission } from '@/shared/lib/permissions';

export async function updateFlutterwavePaymentSettings(
  tenantSlug: string,
  input: {
    enabledCurrencies: string[];
    fxRates: Record<string, string>;
    markupPercent: string;
  },
) {
  await requirePlatformControlAccess(tenantSlug);
  const actor = await requirePermission(tenantSlug, 'platform:billing');

  const markup = Number(input.markupPercent);
  if (!Number.isFinite(markup) || markup < 0 || markup > 50) {
    throw new Error('FX markup must be between 0% and 50%.');
  }

  const settings = await saveMketyPaymentSettings({
    enabledCurrencies: input.enabledCurrencies,
    fxRates: input.fxRates,
    fxMarkupBps: Math.round(markup * 100),
    actorId: actor.userId,
  });

  revalidatePath(`/t/${tenantSlug}/admin/platform-control/enterprise-payments`);
  return settings;
}

'use server';

import { revalidatePath } from 'next/cache';
import { withServerActionDatabase } from '@/shared/db/server-action';

import { requirePlatformControlAccess } from '@/features/platform-content/server/authorization';
import { grantCredits } from '@/features/usage-credits/server/service';
import { requirePermission } from '@/shared/lib/permissions';
import { getTenantBySlug } from '@/shared/lib/tenant';

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

async function grantManualTenantCreditsImpl(opsTenantSlug: string, formData: FormData) {
  const actor = await requirePlatformControlAccess(opsTenantSlug);
  await requirePermission(opsTenantSlug, 'platform:billing');

  const targetTenantSlug = text(formData, 'targetTenantSlug');
  const creditsRaw = text(formData, 'credits');
  const reason = text(formData, 'reason');
  const idempotencyKey = text(formData, 'idempotencyKey');

  if (!targetTenantSlug) throw new Error('Customer workspace slug is required.');
  if (!/^\d+$/.test(creditsRaw)) throw new Error('Credits must be a positive whole number.');
  const credits = BigInt(creditsRaw);
  if (credits <= 0n || credits > 1_000_000_000_000n) {
    throw new Error('Credits must be between 1 and 1,000,000,000,000.');
  }
  if (reason.length < 5 || reason.length > 500) {
    throw new Error('Enter a reason between 5 and 500 characters.');
  }
  if (!idempotencyKey || idempotencyKey.length > 200) {
    throw new Error('Manual credit grant idempotency key is invalid.');
  }

  const target = await getTenantBySlug(targetTenantSlug);
  if (!target) throw new Error('Customer workspace was not found.');

  await grantCredits({
    tenantId: target.id,
    credits,
    idempotencyKey: `platform-manual-grant:${idempotencyKey}`,
    entryType: 'manual_grant',
    source: 'platform-control',
    reason,
    actorUserId: actor.userId,
  });

  revalidatePath(`/t/${opsTenantSlug}/admin/platform-control/billing-ledger`);
  revalidatePath(`/t/${opsTenantSlug}/admin/platform-control/billing`);
  revalidatePath(`/t/${target.slug}/wallet`);
  revalidatePath(`/t/${target.slug}/enterprise-ai`);
}

export async function grantManualTenantCredits(...args: Parameters<typeof grantManualTenantCreditsImpl>) {
  'use server';
  return withServerActionDatabase(() => grantManualTenantCreditsImpl(...args));
}

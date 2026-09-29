'use server';

import { and, desc, eq, isNull } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

import { seedSelfServiceBillingCatalog } from '@/features/billing/server/catalog-seed';
import { requirePlatformControlAccess } from '@/features/platform-content/server/authorization';
import { db } from '@/shared/db';
import { billingPlans, billingPlanVersionEntitlements, billingPlanVersions, mailDomains, mailWorkspaces } from '@/shared/db/schema';
import { requirePermission } from '@/shared/lib/permissions';
import { logAuditEvent } from '@/shared/services/audit-service';

import { resolveTenantMailPlanKey } from './commercial';
import { isMailPlanKey } from '../commercial/plans';

async function requireMailOps(opsTenantSlug: string) {
  const actor = await requirePlatformControlAccess(opsTenantSlug);
  await requirePermission(opsTenantSlug, 'platform:plans');
  return actor;
}

function bool(value: FormDataEntryValue | null) {
  return value === 'on' || value === 'true' || value === '1';
}


function parseUsdMinor(value: FormDataEntryValue | null) {
  const normalized = String(value ?? '').trim();
  if (!/^\d{1,6}(?:\.\d{1,2})?$/.test(normalized)) {
    throw new Error('Enter a valid monthly USD price with at most two decimal places.');
  }
  const [whole, fraction = ''] = normalized.split('.');
  return BigInt(whole) * 100n + BigInt((fraction + '00').slice(0, 2));
}

export async function createMailPlanVersion(opsTenantSlug: string, formData: FormData) {
  const actor = await requireMailOps(opsTenantSlug);
  const planKey = String(formData.get('planKey') || '');
  if (!isMailPlanKey(planKey)) throw new Error('Unknown Mkety Mail plan.');

  const name = String(formData.get('name') || '').trim();
  const description = String(formData.get('description') || '').trim();
  const amountMinor = parseUsdMinor(formData.get('monthlyPriceUsd'));
  if (!name || name.length > 255 || !description || description.length > 2_000) {
    throw new Error('Mail plan name or description is invalid.');
  }
  if (amountMinor < 100n) throw new Error('Mail plan price must be at least $1.00 per month.');

  const now = new Date();
  const result = await db.transaction(async (tx) => {
    const [plan] = await tx
      .select()
      .from(billingPlans)
      .where(eq(billingPlans.key, planKey))
      .limit(1);
    if (!plan) throw new Error('Reconcile the Mail catalog before creating a new plan version.');

    const [active] = await tx
      .select()
      .from(billingPlanVersions)
      .where(and(eq(billingPlanVersions.planId, plan.id), isNull(billingPlanVersions.effectiveTo)))
      .orderBy(desc(billingPlanVersions.version))
      .limit(1);
    if (!active) throw new Error('The Mail plan has no active billing version.');

    const entitlements = await tx
      .select({
        entitlementKey: billingPlanVersionEntitlements.entitlementKey,
        enabled: billingPlanVersionEntitlements.enabled,
      })
      .from(billingPlanVersionEntitlements)
      .where(eq(billingPlanVersionEntitlements.planVersionId, active.id));

    const [latest] = await tx
      .select({ version: billingPlanVersions.version })
      .from(billingPlanVersions)
      .where(eq(billingPlanVersions.planId, plan.id))
      .orderBy(desc(billingPlanVersions.version))
      .limit(1);

    await tx
      .update(billingPlanVersions)
      .set({ effectiveTo: now })
      .where(and(eq(billingPlanVersions.id, active.id), isNull(billingPlanVersions.effectiveTo)));

    const [next] = await tx
      .insert(billingPlanVersions)
      .values({
        planId: plan.id,
        version: (latest?.version ?? active.version) + 1,
        amountMinor,
        currency: 'USD',
        billingInterval: 'monthly',
        isPublic: true,
        metadataReference: `platform-control:mail:${planKey}`,
        effectiveFrom: now,
      })
      .returning();

    if (entitlements.length) {
      await tx.insert(billingPlanVersionEntitlements).values(
        entitlements.map((item) => ({
          planVersionId: next.id,
          entitlementKey: item.entitlementKey,
          enabled: item.enabled,
        })),
      );
    }

    await tx
      .update(billingPlans)
      .set({ name, description, status: 'active', updatedAt: now })
      .where(eq(billingPlans.id, plan.id));

    return { previousVersion: active.version, version: next.version, amountMinor };
  });

  await logAuditEvent({
    actorId: actor.userId,
    action: 'mail.catalog.version_created',
    entityType: 'billing_plan',
    entityId: planKey,
    changes: {
      name,
      description,
      monthlyAmountMinor: result.amountMinor.toString(),
      previousVersion: result.previousVersion,
      version: result.version,
    },
  });

  revalidatePath('/mail');
  revalidatePath('/pricing');
  revalidatePath(`/t/${opsTenantSlug}/admin/platform-control/mail`);
}

export async function reconcileMailCatalog(opsTenantSlug: string) {
  const actor = await requireMailOps(opsTenantSlug);
  const result = await seedSelfServiceBillingCatalog();
  await logAuditEvent({
    actorId: actor.userId,
    action: 'mail.catalog.reconciled',
    entityType: 'mail_catalog',
    metadata: { ...result },
  });
  revalidatePath(`/t/${opsTenantSlug}/admin/platform-control/mail`);
}

export async function updateMailWorkspaceOperations(opsTenantSlug: string, formData: FormData) {
  const actor = await requireMailOps(opsTenantSlug);
  const workspaceId = String(formData.get('workspaceId') || '');
  const targetTenantId = String(formData.get('targetTenantId') || '');
  const status = String(formData.get('status') || '');
  const onboardingStep = String(formData.get('onboardingStep') || '');
  if (!workspaceId || !targetTenantId || !['active','suspended'].includes(status) || !['domain','ready'].includes(onboardingStep)) {
    throw new Error('Invalid Mail workspace operations update.');
  }

  const planKey = await resolveTenantMailPlanKey(targetTenantId);
  await db
    .update(mailWorkspaces)
    .set({ status, onboardingStep, planKey, updatedAt: new Date() })
    .where(and(eq(mailWorkspaces.id, workspaceId), eq(mailWorkspaces.tenantId, targetTenantId)));

  await logAuditEvent({
    actorId: actor.userId,
    action: 'mail.workspace.operations_updated',
    entityType: 'mail_workspace',
    entityId: workspaceId,
    changes: { status, onboardingStep, planKey },
    metadata: { targetTenantId },
  });
  revalidatePath(`/t/${opsTenantSlug}/admin/platform-control/mail`);
}

export async function updateMailDomainOperations(opsTenantSlug: string, formData: FormData) {
  const actor = await requireMailOps(opsTenantSlug);
  const domainId = String(formData.get('domainId') || '');
  const targetTenantId = String(formData.get('targetTenantId') || '');
  const status = String(formData.get('status') || '');
  const spfStatus = String(formData.get('spfStatus') || '');
  const dkimStatus = String(formData.get('dkimStatus') || '');
  const dmarcStatus = String(formData.get('dmarcStatus') || '');
  const mxStatus = String(formData.get('mxStatus') || '');
  const readiness = ['pending','verified','failed','disabled'];
  if (
    !domainId ||
    !targetTenantId ||
    !readiness.includes(status) ||
    !readiness.includes(spfStatus) ||
    !readiness.includes(dkimStatus) ||
    !readiness.includes(dmarcStatus) ||
    !readiness.includes(mxStatus)
  ) {
    throw new Error('Invalid Mail domain operations update.');
  }

  const sendingEnabled = bool(formData.get('sendingEnabled'));
  const routingEnabled = bool(formData.get('routingEnabled'));
  const verified = status === 'verified' && spfStatus === 'verified' && dkimStatus === 'verified' && dmarcStatus === 'verified' && mxStatus === 'verified';

  await db
    .update(mailDomains)
    .set({
      status,
      spfStatus,
      dkimStatus,
      dmarcStatus,
      mxStatus,
      sendingEnabled,
      routingEnabled,
      verifiedAt: verified ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(and(eq(mailDomains.id, domainId), eq(mailDomains.tenantId, targetTenantId)));

  await logAuditEvent({
    actorId: actor.userId,
    action: 'mail.domain.operations_updated',
    entityType: 'mail_domain',
    entityId: domainId,
    changes: { status, spfStatus, dkimStatus, dmarcStatus, mxStatus, sendingEnabled, routingEnabled },
    metadata: { targetTenantId },
  });
  revalidatePath(`/t/${opsTenantSlug}/admin/platform-control/mail`);
}

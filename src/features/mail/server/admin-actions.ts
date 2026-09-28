'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

import { seedSelfServiceBillingCatalog } from '@/features/billing/server/catalog-seed';
import { requirePlatformControlAccess } from '@/features/platform-content/server/authorization';
import { db } from '@/shared/db';
import { mailDomains, mailWorkspaces } from '@/shared/db/schema';
import { requirePermission } from '@/shared/lib/permissions';
import { logAuditEvent } from '@/shared/services/audit-service';

import { resolveTenantMailPlanKey } from './commercial';

async function requireMailOps(opsTenantSlug: string) {
  const actor = await requirePlatformControlAccess(opsTenantSlug);
  await requirePermission(opsTenantSlug, 'platform:plans');
  return actor;
}

function bool(value: FormDataEntryValue | null) {
  return value === 'on' || value === 'true' || value === '1';
}

export async function reconcileMailCatalog(opsTenantSlug: string) {
  const actor = await requireMailOps(opsTenantSlug);
  const result = await seedSelfServiceBillingCatalog();
  await logAuditEvent({
    actorId: actor.userId,
    action: 'mail.catalog.reconciled',
    entityType: 'mail_catalog',
    metadata: result,
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

'use server';

import { and, eq } from 'drizzle-orm';

import { requirePlatformControlAccess } from '@/features/platform-content/server/authorization';
import { runPlatformControlMutation } from '@/shared/db/platform-control-mutation';
import { deploymentRequests } from '@/shared/db/schema';
import { requirePermission } from '@/shared/lib/permissions';
import { getTenantBySlug } from '@/shared/lib/tenant';

const MAX_REVIEW_NOTE_LENGTH = 500;

function cleanOptional(value: FormDataEntryValue | null, max: number): string | null {
  const cleaned = String(value ?? '').trim();
  return cleaned ? cleaned.slice(0, max) : null;
}

async function reviewDeploymentRequestImpl(formData: FormData) {
  const tenantSlug = String(formData.get('tenantSlug') || '');
  const requestId = String(formData.get('requestId') || '');
  const decision = String(formData.get('decision') || '');

  if (!requestId) throw new Error('Deployment request id is required.');
  if (decision !== 'approved' && decision !== 'rejected') {
    throw new Error('Deployment review decision is invalid.');
  }

  await requirePlatformControlAccess(tenantSlug);
  const reviewer = await requirePermission(tenantSlug, 'platform:deployments');
  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) throw new Error('Workspace not found.');

  const { db } = await import('@/shared/db');
  const rows = await db
      .update(deploymentRequests)
      .set({
        status: decision,
        reviewedByUserId: reviewer.userId,
        reviewedAt: new Date(),
        reviewNote: cleanOptional(formData.get('reviewNote'), MAX_REVIEW_NOTE_LENGTH),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(deploymentRequests.id, requestId),
          eq(deploymentRequests.tenantId, tenant.id),
          eq(deploymentRequests.status, 'pending'),
        ),
      )
      .returning({ id: deploymentRequests.id });

  if (rows.length !== 1) {
    throw new Error('Deployment request is no longer pending or does not belong to this workspace.');
  }
}

export async function reviewDeploymentRequest(formData: FormData) {
  const tenantSlug = String(formData.get('tenantSlug') || '');
  return runPlatformControlMutation({
    path: `/t/${tenantSlug}/admin/platform-control/deployments-domains`,
    action: 'deployment-review',
    work: () => reviewDeploymentRequestImpl(formData),
  });
}

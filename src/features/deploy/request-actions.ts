'use server';

import { and, desc, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

import { requireProjectAccess } from '@/features/projects/server/access';
import { withRequestDatabase } from '@/shared/db/request';
import {
  deployApplications,
  deployEnvironments,
  deploymentRequests,
} from '@/shared/db/schema';
import { requirePermission } from '@/shared/lib/permissions';
import { getTenantBySlug } from '@/shared/lib/tenant';

const MAX_REF_LENGTH = 240;
const MAX_REVIEW_NOTE_LENGTH = 500;

function cleanOptional(value: FormDataEntryValue | null, max: number): string | null {
  const cleaned = String(value ?? '').trim();
  return cleaned ? cleaned.slice(0, max) : null;
}

export async function createDeploymentRequest(formData: FormData) {
  const tenantSlug = String(formData.get('tenantSlug') || '');
  const projectSlug = String(formData.get('projectSlug') || '');
  const environmentId = String(formData.get('environmentId') || '');
  const access = await requireProjectAccess({ tenantSlug, projectSlug });

  if (access.status !== 'ok') throw new Error(access.reason);
  if (!access.canManage) throw new Error('You do not have permission to request deployments.');
  if (!environmentId) throw new Error('A deployment environment is required.');

  await withRequestDatabase(async (db) => {
    const environment = await db.query.deployEnvironments.findFirst({
      where: and(
        eq(deployEnvironments.id, environmentId),
        eq(deployEnvironments.tenantId, access.tenant.id),
        eq(deployEnvironments.projectId, access.project.id),
      ),
    });
    if (!environment) throw new Error('Deploy environment not found.');
    if (environment.protected || environment.kind === 'production') {
      throw new Error('Production or protected environments cannot be requested yet.');
    }

    const application = await db.query.deployApplications.findFirst({
      where: and(
        eq(deployApplications.id, environment.applicationId),
        eq(deployApplications.tenantId, access.tenant.id),
        eq(deployApplications.projectId, access.project.id),
      ),
      columns: { id: true },
    });
    if (!application) throw new Error('Deploy application not found.');

    const existing = await db.query.deploymentRequests.findFirst({
      where: and(
        eq(deploymentRequests.environmentId, environment.id),
        eq(deploymentRequests.status, 'pending'),
      ),
      columns: { id: true },
      orderBy: [desc(deploymentRequests.requestedAt)],
    });
    if (existing) throw new Error('A deployment request is already pending for this environment.');

    await db.insert(deploymentRequests).values({
      tenantId: access.tenant.id,
      projectId: access.project.id,
      applicationId: application.id,
      environmentId: environment.id,
      requestedByUserId: access.session.user.id,
      releaseRef: cleanOptional(formData.get('releaseRef'), MAX_REF_LENGTH),
      sourceRef: cleanOptional(formData.get('sourceRef'), MAX_REF_LENGTH),
      status: 'pending',
    });
  });

  revalidatePath(`/t/${tenantSlug}/projects/${projectSlug}/deploy`);
  revalidatePath(`/t/${tenantSlug}/admin/platform-control/deployments-domains`);
}

export async function reviewDeploymentRequest(formData: FormData) {
  const tenantSlug = String(formData.get('tenantSlug') || '');
  const requestId = String(formData.get('requestId') || '');
  const decision = String(formData.get('decision') || '');
  if (!requestId) throw new Error('Deployment request id is required.');
  if (!['approved', 'rejected'].includes(decision)) {
    throw new Error('Deployment review decision is invalid.');
  }

  const reviewer = await requirePermission(tenantSlug, 'platform:deployments');
  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) throw new Error('Workspace not found.');

  await withRequestDatabase(async (db) => {
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
  });

  revalidatePath(`/t/${tenantSlug}/admin/platform-control/deployments-domains`);
}

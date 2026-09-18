'use server';

import { and, eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';

import { requireProjectAccess } from '@/features/projects/server/access';
import { withRequestDatabase } from '@/shared/db/request';
import { deployApplications, deployEnvironments } from '@/shared/db/schema';

const APPLICATION_KINDS = new Set(['web', 'api', 'service']);
const ENVIRONMENT_KINDS = new Set(['development', 'preview', 'staging', 'production']);

function slugify(value: string, max = 90) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max);
}

async function requireDeployManager(tenantSlug: string, projectSlug: string) {
  const access = await requireProjectAccess({ tenantSlug, projectSlug });
  if (access.status !== 'ok') throw new Error(access.reason);
  if (!access.canManage) throw new Error('You do not have permission to manage Deploy metadata.');
  return access;
}

export async function createDeployApplication(formData: FormData) {
  const tenantSlug = String(formData.get('tenantSlug') || '');
  const projectSlug = String(formData.get('projectSlug') || '');
  const access = await requireDeployManager(tenantSlug, projectSlug);

  const name = String(formData.get('name') || '').trim();
  const slug = slugify(String(formData.get('slug') || name));
  const requestedKind = String(formData.get('kind') || 'web');
  const kind = APPLICATION_KINDS.has(requestedKind) ? requestedKind : 'web';

  if (!name || !slug) throw new Error('Application name and slug are required.');

  await withRequestDatabase(async (db) => {
    const existing = await db.query.deployApplications.findFirst({
      where: and(
        eq(deployApplications.projectId, access.project.id),
        eq(deployApplications.slug, slug),
      ),
      columns: { id: true },
    });
    if (existing) throw new Error('That application slug is already in use in this project.');

    await db.insert(deployApplications).values({
      tenantId: access.tenant.id,
      projectId: access.project.id,
      name,
      slug,
      kind,
      createdByUserId: access.session.user.id,
    });
  });

  redirect(`/t/${access.tenant.slug}/projects/${access.project.slug}/deploy`);
}

export async function createDeployEnvironment(formData: FormData) {
  const tenantSlug = String(formData.get('tenantSlug') || '');
  const projectSlug = String(formData.get('projectSlug') || '');
  const access = await requireDeployManager(tenantSlug, projectSlug);

  const applicationId = String(formData.get('applicationId') || '');
  const name = String(formData.get('name') || '').trim();
  const slug = slugify(String(formData.get('slug') || name), 64);
  const requestedKind = String(formData.get('kind') || 'development');
  const kind = ENVIRONMENT_KINDS.has(requestedKind) ? requestedKind : 'development';

  if (!applicationId || !name || !slug) {
    throw new Error('Application, environment name and slug are required.');
  }

  await withRequestDatabase(async (db) => {
    const application = await db.query.deployApplications.findFirst({
      where: and(
        eq(deployApplications.id, applicationId),
        eq(deployApplications.tenantId, access.tenant.id),
        eq(deployApplications.projectId, access.project.id),
      ),
      columns: { id: true },
    });
    if (!application) throw new Error('Deploy application not found.');

    const existing = await db.query.deployEnvironments.findFirst({
      where: and(
        eq(deployEnvironments.applicationId, application.id),
        eq(deployEnvironments.slug, slug),
      ),
      columns: { id: true },
    });
    if (existing) throw new Error('That environment slug is already in use for this application.');

    await db.insert(deployEnvironments).values({
      tenantId: access.tenant.id,
      projectId: access.project.id,
      applicationId: application.id,
      name,
      slug,
      kind,
      protected: kind === 'production',
      createdByUserId: access.session.user.id,
    });
  });

  redirect(`/t/${access.tenant.slug}/projects/${access.project.slug}/deploy`);
}

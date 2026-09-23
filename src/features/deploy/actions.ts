'use server';

import { and, desc, eq, isNull } from 'drizzle-orm';
import { redirect } from 'next/navigation';

import { requireEntitlement } from '@/features/entitlements/server/authorization';
import { requireProjectAccess } from '@/features/projects/server/access';
import { drizzleDeploymentExecutionRepository } from '@/features/deploy/server/execution/drizzle-repository';
import { executeDeployment } from '@/features/deploy/server/execution/service';
import { createCustomerCandidateProvider } from '@/features/deploy/server/providers/customer-candidate-runtime';
import { withRequestDatabase } from '@/shared/db/request';
import {
  deployApplications,
  deployEnvironments,
  deploymentRequests,
  deployments,
} from '@/shared/db/schema';

const APPLICATION_KINDS = new Set(['web', 'api', 'service']);
const ENVIRONMENT_KINDS = new Set(['development', 'preview', 'staging', 'production']);
const DEPLOY_REF_PATTERN = /^[A-Za-z0-9._/@:+-]{1,160}$/;

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

async function requireDeployEntitlement(tenantId: string) {
  await requireEntitlement({
    tenantId,
    entitlement: 'workspace.deploy',
  });
}

function readDeploymentRefs(formData: FormData) {
  const releaseRef = String(formData.get('releaseRef') || '').trim();
  const sourceRef = String(formData.get('sourceRef') || '').trim();

  if (!DEPLOY_REF_PATTERN.test(releaseRef)) {
    throw new Error('Release reference is invalid.');
  }
  if (sourceRef && !DEPLOY_REF_PATTERN.test(sourceRef)) {
    throw new Error('Source reference is invalid.');
  }

  return { releaseRef, sourceRef: sourceRef || null };
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

export async function createDeploymentRequest(formData: FormData) {
  const tenantSlug = String(formData.get('tenantSlug') || '');
  const projectSlug = String(formData.get('projectSlug') || '');
  const environmentId = String(formData.get('environmentId') || '');
  const access = await requireDeployManager(tenantSlug, projectSlug);
  await requireDeployEntitlement(access.tenant.id);

  if (!environmentId) throw new Error('Deploy environment is required.');
  const refs = readDeploymentRefs(formData);

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
      throw new Error('Production and protected environments cannot be requested.');
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
      releaseRef: refs.releaseRef,
      sourceRef: refs.sourceRef,
      status: 'pending',
    });
  });

  redirect(`/t/${access.tenant.slug}/projects/${access.project.slug}/deploy?request=created`);
}

export async function executeApprovedDeploymentRequest(formData: FormData) {
  const tenantSlug = String(formData.get('tenantSlug') || '');
  const projectSlug = String(formData.get('projectSlug') || '');
  const requestId = String(formData.get('requestId') || '');
  const access = await requireDeployManager(tenantSlug, projectSlug);
  await requireDeployEntitlement(access.tenant.id);

  if (!requestId) throw new Error('Deployment request id is required.');

  const claimed = await withRequestDatabase(async (db) =>
    db.transaction(async (tx) => {
      const request = await tx.query.deploymentRequests.findFirst({
        where: and(
          eq(deploymentRequests.id, requestId),
          eq(deploymentRequests.tenantId, access.tenant.id),
          eq(deploymentRequests.projectId, access.project.id),
          eq(deploymentRequests.status, 'approved'),
          isNull(deploymentRequests.executionDeploymentId),
        ),
      });
      if (!request) {
        throw new Error('Deployment request is not approved, was already consumed, or does not belong to this project.');
      }

      const environment = await tx.query.deployEnvironments.findFirst({
        where: and(
          eq(deployEnvironments.id, request.environmentId),
          eq(deployEnvironments.tenantId, access.tenant.id),
          eq(deployEnvironments.projectId, access.project.id),
          eq(deployEnvironments.applicationId, request.applicationId),
        ),
      });
      if (!environment) throw new Error('Approved deploy environment no longer exists.');
      if (environment.protected || environment.kind === 'production') {
        throw new Error('Production and protected environments cannot be executed.');
      }

      const application = await tx.query.deployApplications.findFirst({
        where: and(
          eq(deployApplications.id, request.applicationId),
          eq(deployApplications.tenantId, access.tenant.id),
          eq(deployApplications.projectId, access.project.id),
        ),
      });
      if (!application) throw new Error('Approved deploy application no longer exists.');

      const [deployment] = await tx
        .insert(deployments)
        .values({
          tenantId: request.tenantId,
          projectId: request.projectId,
          applicationId: request.applicationId,
          environmentId: request.environmentId,
          status: 'queued',
          releaseRef: request.releaseRef,
          sourceRef: request.sourceRef,
          provider: 'cloudflare',
          createdByUserId: access.session.user.id,
        })
        .returning({ id: deployments.id });
      if (!deployment) throw new Error('Failed to create approved deployment execution record.');

      const claimedRows = await tx
        .update(deploymentRequests)
        .set({
          status: 'executing',
          executionDeploymentId: deployment.id,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(deploymentRequests.id, request.id),
            eq(deploymentRequests.status, 'approved'),
            isNull(deploymentRequests.executionDeploymentId),
          ),
        )
        .returning({ id: deploymentRequests.id });

      if (claimedRows.length !== 1) {
        throw new Error('Deployment request was consumed by another execution.');
      }

      return {
        requestId: request.id,
        deploymentId: deployment.id,
        context: {
          tenantId: request.tenantId,
          projectId: request.projectId,
          application: {
            id: application.id,
            name: application.name,
            slug: application.slug,
            kind: application.kind,
          },
          environment: {
            id: environment.id,
            name: environment.name,
            slug: environment.slug,
            kind: environment.kind,
            protected: environment.protected,
          },
          releaseRef: request.releaseRef,
          sourceRef: request.sourceRef,
          requestedByUserId: access.session.user.id,
        },
      };
    }),
  );

  let outcome: 'completed' | 'failed' = 'completed';
  try {
    const provider = createCustomerCandidateProvider({
      MKETY_DEPLOY_CLOUDFLARE_ACCOUNT_ID: process.env.MKETY_DEPLOY_CLOUDFLARE_ACCOUNT_ID,
      MKETY_DEPLOY_CLOUDFLARE_API_TOKEN: process.env.MKETY_DEPLOY_CLOUDFLARE_API_TOKEN,
    });

    await executeDeployment(
      drizzleDeploymentExecutionRepository,
      provider,
      claimed.context,
      { queuedDeploymentId: claimed.deploymentId },
    );

    await withRequestDatabase(async (db) => {
      await db
        .update(deploymentRequests)
        .set({ status: 'completed', updatedAt: new Date() })
        .where(
          and(
            eq(deploymentRequests.id, claimed.requestId),
            eq(deploymentRequests.status, 'executing'),
            eq(deploymentRequests.executionDeploymentId, claimed.deploymentId),
          ),
        );
    });
  } catch {
    outcome = 'failed';
    await withRequestDatabase(async (db) => {
      await db
        .update(deploymentRequests)
        .set({ status: 'failed', updatedAt: new Date() })
        .where(
          and(
            eq(deploymentRequests.id, claimed.requestId),
            eq(deploymentRequests.status, 'executing'),
            eq(deploymentRequests.executionDeploymentId, claimed.deploymentId),
          ),
        );
    });
  }

  redirect(
    `/t/${access.tenant.slug}/projects/${access.project.slug}/deploy?candidate=${outcome}`,
  );
}

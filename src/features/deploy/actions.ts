'use server';

import { and, desc, eq, isNull } from 'drizzle-orm';
import { redirect } from 'next/navigation';

import { createMketyAppHostname } from '@/features/deploy/hostnames';
import { drizzleDeploymentExecutionRepository } from '@/features/deploy/server/execution/drizzle-repository';
import { executeDeployment } from '@/features/deploy/server/execution/service';
import { buildProductionAliasPromotion } from '@/features/deploy/server/production-promotion';
import { createCustomerCandidateProvider } from '@/features/deploy/server/providers/customer-candidate-runtime';
import { parseCustomerDeploymentArtifact } from '@/features/deploy/server/providers/customer-deployment-artifact';
import {
  deleteCustomerDeploymentArtifact,
  storeCustomerDeploymentArtifact,
} from '@/features/deploy/server/providers/customer-deployment-artifacts-store';
import { createCustomerDeploymentProvider } from '@/features/deploy/server/providers/customer-deployment-runtime';
import { requireEntitlement } from '@/features/entitlements/server/authorization';
import { requireProjectAccess } from '@/features/projects/server/access';
import { withRequestDatabase } from '@/shared/db/request';
import {
  auditEvents,
  deployApplications,
  deployEnvironments,
  deploymentHostnames,
  deploymentRequests,
  deployments,
} from '@/shared/db/schema';

const APPLICATION_KINDS = new Set(['web', 'api', 'service']);
const ENVIRONMENT_KINDS = new Set(['development', 'preview', 'staging', 'production']);
const DEPLOY_REF_PATTERN = /^[A-Za-z0-9._/@:+-]{1,160}$/;
const MAX_ARTIFACT_JSON_BYTES = 1_100_000;

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

async function readCustomerArtifact(formData: FormData) {
  const file = formData.get('artifactBundle');
  if (!file || typeof file !== 'object' || !('size' in file) || !('text' in file)) {
    throw new Error('Upload a customer application bundle before requesting deployment.');
  }
  const artifactFile = file as File;
  if (artifactFile.size <= 0 || artifactFile.size > MAX_ARTIFACT_JSON_BYTES) {
    throw new Error('Customer application bundle must be no larger than 1.1 MiB.');
  }
  let raw: unknown;
  try {
    raw = JSON.parse(await artifactFile.text());
  } catch {
    throw new Error('Customer application bundle must be a valid JSON module manifest.');
  }
  return parseCustomerDeploymentArtifact(raw);
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

  redirect(`/app/${access.tenant.slug}/projects/${access.project.slug}/deploy`);
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

  redirect(`/app/${access.tenant.slug}/projects/${access.project.slug}/deploy`);
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

  redirect(`/app/${access.tenant.slug}/projects/${access.project.slug}/deploy?request=created`);
}

export async function createCustomerDeploymentRequest(formData: FormData) {
  const tenantSlug = String(formData.get('tenantSlug') || '');
  const projectSlug = String(formData.get('projectSlug') || '');
  const environmentId = String(formData.get('environmentId') || '');
  const access = await requireDeployManager(tenantSlug, projectSlug);
  await requireDeployEntitlement(access.tenant.id);
  if (!environmentId) throw new Error('Deploy environment is required.');
  const refs = readDeploymentRefs(formData);
  const artifact = await readCustomerArtifact(formData);
  const requestId = crypto.randomUUID();
  let artifactKey: string | null = null;
  let artifactSha256: string | null = null;

  try {
    const stored = await storeCustomerDeploymentArtifact({
      tenantId: access.tenant.id,
      projectId: access.project.id,
      requestId,
      artifact,
    });
    artifactKey = stored.key;
    artifactSha256 = stored.sha256;
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
        throw new Error('Customer application deployment is limited to non-production environments.');
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
        id: requestId,
        tenantId: access.tenant.id,
        projectId: access.project.id,
        applicationId: application.id,
        environmentId: environment.id,
        requestedByUserId: access.session.user.id,
        releaseRef: refs.releaseRef,
        sourceRef: refs.sourceRef,
        artifactKey,
        artifactSha256,
        status: 'pending',
      });
    });
  } catch (error) {
    if (artifactKey) {
      await deleteCustomerDeploymentArtifact({ tenantId: access.tenant.id, projectId: access.project.id, requestId })
        .catch(() => undefined);
    }
    throw error;
  }
  redirect(`/app/${access.tenant.slug}/projects/${access.project.slug}/deploy?customerRequest=created`);
}

async function executeApprovedRequest(formData: FormData, customerApp: boolean) {
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
      if (request.promotionDeploymentId) {
        throw new Error('Production alias promotion requests must use the approved alias transition action.');
      }
      if (customerApp !== Boolean(request.artifactKey)) {
        throw new Error('Approved deployment request type does not match the requested execution path.');
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
      ...(customerApp ? {
        deploymentRequestId: request.id,
        artifactKey: request.artifactKey,
        artifactSha256: request.artifactSha256,
      } : {}),
        },
        projectSlug: access.project.slug,
        applicationId: application.id,
        environmentId: environment.id,
      };
    }),
  );

  let outcome: 'completed' | 'failed' = 'completed';
  let previewHostname: string | null = null;
  try {
    const providerEnvironment = {
      MKETY_DEPLOY_CLOUDFLARE_ACCOUNT_ID: process.env.MKETY_DEPLOY_CLOUDFLARE_ACCOUNT_ID,
      MKETY_DEPLOY_CLOUDFLARE_API_TOKEN: process.env.MKETY_DEPLOY_CLOUDFLARE_API_TOKEN,
    };
    const provider = customerApp
      ? createCustomerDeploymentProvider({
          ...providerEnvironment,
          MKETY_DEPLOY_CLOUDFLARE_DISPATCH_NAMESPACE: process.env.MKETY_DEPLOY_CLOUDFLARE_DISPATCH_NAMESPACE,
        })
      : createCustomerCandidateProvider(providerEnvironment);

    await executeDeployment(
      drizzleDeploymentExecutionRepository,
      provider,
      claimed.context,
      { queuedDeploymentId: claimed.deploymentId },
    );

    if (customerApp) {
      previewHostname = createMketyAppHostname(claimed.projectSlug, claimed.deploymentId);
      await withRequestDatabase(async (db) => {
        await db.insert(deploymentHostnames).values({
          hostname: previewHostname!,
          tenantId: access.tenant.id,
          projectId: access.project.id,
          applicationId: claimed.applicationId,
          environmentId: claimed.environmentId,
          deploymentId: claimed.deploymentId,
          kind: 'preview',
          status: 'active',
          createdByUserId: access.session.user.id,
        });
      });
    }

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
    customerApp && previewHostname && outcome === 'completed'
      ? `/app/${access.tenant.slug}/projects/${access.project.slug}/deploy?preview=completed&host=${encodeURIComponent(previewHostname)}`
      : `/app/${access.tenant.slug}/projects/${access.project.slug}/deploy?${customerApp ? 'preview' : 'candidate'}=${outcome}`,
  );
}

export async function createProductionPromotionRequest(formData: FormData) {
  const tenantSlug = String(formData.get('tenantSlug') || '');
  const projectSlug = String(formData.get('projectSlug') || '');
  const deploymentId = String(formData.get('deploymentId') || '');
  const access = await requireDeployManager(tenantSlug, projectSlug);
  await requireDeployEntitlement(access.tenant.id);
  if (!deploymentId) throw new Error('Completed preview deployment is required.');

  await withRequestDatabase(async (db) => {
    const target = await db.query.deployments.findFirst({
      where: and(
        eq(deployments.id, deploymentId),
        eq(deployments.tenantId, access.tenant.id),
        eq(deployments.projectId, access.project.id),
      ),
    });
    if (!target) throw new Error('Customer deployment not found.');
    const application = await db.query.deployApplications.findFirst({
      where: and(
        eq(deployApplications.id, target.applicationId),
        eq(deployApplications.tenantId, access.tenant.id),
        eq(deployApplications.projectId, access.project.id),
      ),
    });
    if (!application) throw new Error('Customer application not found.');
    const targetEnvironment = await db.query.deployEnvironments.findFirst({
      where: and(
        eq(deployEnvironments.id, target.environmentId),
        eq(deployEnvironments.tenantId, access.tenant.id),
        eq(deployEnvironments.projectId, access.project.id),
        eq(deployEnvironments.applicationId, application.id),
      ),
    });
    if (!targetEnvironment) throw new Error('Customer deployment environment is no longer available.');
    const preview = await db.query.deploymentHostnames.findFirst({
      where: and(
        eq(deploymentHostnames.deploymentId, target.id),
        eq(deploymentHostnames.tenantId, access.tenant.id),
        eq(deploymentHostnames.projectId, access.project.id),
        eq(deploymentHostnames.applicationId, application.id),
        eq(deploymentHostnames.environmentId, targetEnvironment.id),
        eq(deploymentHostnames.kind, 'preview'),
        eq(deploymentHostnames.status, 'active'),
      ),
    });
    const productionEnvironment = await db.query.deployEnvironments.findFirst({
      where: and(
        eq(deployEnvironments.tenantId, access.tenant.id),
        eq(deployEnvironments.projectId, access.project.id),
        eq(deployEnvironments.applicationId, application.id),
        eq(deployEnvironments.kind, 'production'),
        eq(deployEnvironments.protected, true),
      ),
    });
    if (!productionEnvironment) throw new Error('A protected production environment is required for this application.');

    const hostname = createMketyAppHostname(access.project.slug, application.id);
    const currentAlias = await db.query.deploymentHostnames.findFirst({
      where: eq(deploymentHostnames.hostname, hostname),
    });
    buildProductionAliasPromotion({
      projectSlug: access.project.slug,
      deployment: {
        deploymentId: target.id,
        tenantId: target.tenantId,
        projectId: target.projectId,
        applicationId: target.applicationId,
        applicationSlug: application.slug,
        status: target.status,
        environmentKind: targetEnvironment.kind,
        providerDeploymentRef: target.providerDeploymentRef,
        previewHostname: preview?.hostname ?? null,
        previewHostnameKind: preview?.kind ?? null,
        previewHostnameStatus: preview?.status ?? null,
      },
      productionEnvironment,
      currentAlias: currentAlias ?? null,
    });

    const pending = await db.query.deploymentRequests.findFirst({
      where: and(
        eq(deploymentRequests.promotionDeploymentId, target.id),
        eq(deploymentRequests.status, 'pending'),
      ),
      columns: { id: true },
    });
    if (pending) throw new Error('A production alias promotion request is already pending for this deployment.');
    await db.insert(deploymentRequests).values({
      tenantId: access.tenant.id,
      projectId: access.project.id,
      applicationId: application.id,
      environmentId: productionEnvironment.id,
      requestedByUserId: access.session.user.id,
      releaseRef: target.releaseRef ?? target.id,
      sourceRef: target.sourceRef,
      promotionDeploymentId: target.id,
      status: 'pending',
    });
  });
  redirect(`/app/${access.tenant.slug}/projects/${access.project.slug}/deploy?promotion=requested`);
}

export async function executeApprovedProductionPromotionRequest(formData: FormData) {
  const tenantSlug = String(formData.get('tenantSlug') || '');
  const projectSlug = String(formData.get('projectSlug') || '');
  const requestId = String(formData.get('requestId') || '');
  const access = await requireDeployManager(tenantSlug, projectSlug);
  await requireDeployEntitlement(access.tenant.id);
  if (!requestId) throw new Error('Production promotion request id is required.');

  await withRequestDatabase(async (db) => db.transaction(async (tx) => {
    const request = await tx.query.deploymentRequests.findFirst({
      where: and(
        eq(deploymentRequests.id, requestId),
        eq(deploymentRequests.tenantId, access.tenant.id),
        eq(deploymentRequests.projectId, access.project.id),
        eq(deploymentRequests.status, 'approved'),
        isNull(deploymentRequests.executionDeploymentId),
      ),
    });
    if (!request?.promotionDeploymentId) {
      throw new Error('Approved production alias promotion request was not found or was already consumed.');
    }
    const target = await tx.query.deployments.findFirst({
      where: and(
        eq(deployments.id, request.promotionDeploymentId),
        eq(deployments.tenantId, access.tenant.id),
        eq(deployments.projectId, access.project.id),
        eq(deployments.applicationId, request.applicationId),
      ),
    });
    const targetEnvironment = target ? await tx.query.deployEnvironments.findFirst({
      where: and(
        eq(deployEnvironments.id, target.environmentId),
        eq(deployEnvironments.tenantId, access.tenant.id),
        eq(deployEnvironments.projectId, access.project.id),
        eq(deployEnvironments.applicationId, request.applicationId),
      ),
    }) : null;
    const preview = target ? await tx.query.deploymentHostnames.findFirst({
      where: and(
        eq(deploymentHostnames.deploymentId, target.id),
        eq(deploymentHostnames.tenantId, access.tenant.id),
        eq(deploymentHostnames.projectId, access.project.id),
        eq(deploymentHostnames.applicationId, request.applicationId),
        ...(targetEnvironment ? [eq(deploymentHostnames.environmentId, targetEnvironment.id)] : []),
        eq(deploymentHostnames.kind, 'preview'),
        eq(deploymentHostnames.status, 'active'),
      ),
    }) : null;
    const application = await tx.query.deployApplications.findFirst({
      where: and(
        eq(deployApplications.id, request.applicationId),
        eq(deployApplications.tenantId, access.tenant.id),
        eq(deployApplications.projectId, access.project.id),
      ),
    });
    const productionEnvironment = await tx.query.deployEnvironments.findFirst({
      where: and(
        eq(deployEnvironments.id, request.environmentId),
        eq(deployEnvironments.tenantId, access.tenant.id),
        eq(deployEnvironments.projectId, access.project.id),
        eq(deployEnvironments.applicationId, request.applicationId),
      ),
    });
    if (!target || !targetEnvironment || !preview || !application || !productionEnvironment) {
      throw new Error('Approved production promotion target is no longer available.');
    }
    const hostname = createMketyAppHostname(access.project.slug, application.id);
    const currentAlias = await tx.query.deploymentHostnames.findFirst({
      where: eq(deploymentHostnames.hostname, hostname),
    });
    const promotion = buildProductionAliasPromotion({
      projectSlug: access.project.slug,
      deployment: {
        deploymentId: target.id,
        tenantId: target.tenantId,
        projectId: target.projectId,
        applicationId: target.applicationId,
        applicationSlug: application.slug,
        status: target.status,
        environmentKind: targetEnvironment.kind,
        providerDeploymentRef: target.providerDeploymentRef,
        previewHostname: preview.hostname,
        previewHostnameKind: preview.kind,
        previewHostnameStatus: preview.status,
      },
      productionEnvironment,
      currentAlias: currentAlias ?? null,
    });

    let productionAliasId = currentAlias?.id ?? null;
    if (currentAlias) {
      const updated = await tx.update(deploymentHostnames)
        .set({
          environmentId: productionEnvironment.id,
          deploymentId: promotion.deploymentId,
          updatedAt: new Date(),
        })
        .where(and(
          eq(deploymentHostnames.id, currentAlias.id),
          eq(deploymentHostnames.status, 'active'),
          eq(deploymentHostnames.deploymentId, currentAlias.deploymentId),
        ))
        .returning({ id: deploymentHostnames.id });
      if (updated.length !== 1) throw new Error('Production alias changed while this promotion was being applied. Retry from the latest preview.');
    } else {
      const [insertedAlias] = await tx.insert(deploymentHostnames).values({
        hostname: promotion.hostname,
        tenantId: request.tenantId,
        projectId: request.projectId,
        applicationId: request.applicationId,
        environmentId: productionEnvironment.id,
        deploymentId: target.id,
        kind: 'production',
        status: 'active',
        createdByUserId: access.session.user.id,
      }).returning({ id: deploymentHostnames.id });
      productionAliasId = insertedAlias?.id ?? null;
    }

    const consumed = await tx.update(deploymentRequests)
      .set({ status: 'completed', executionDeploymentId: target.id, updatedAt: new Date() })
      .where(and(
        eq(deploymentRequests.id, request.id),
        eq(deploymentRequests.status, 'approved'),
        isNull(deploymentRequests.executionDeploymentId),
      ))
      .returning({ id: deploymentRequests.id });
    if (consumed.length !== 1) throw new Error('Production promotion request was consumed by another action.');

    await tx.insert(auditEvents).values({
      tenantId: request.tenantId,
      action: 'deployment.production_alias.promoted',
      entityType: 'deployment_hostname',
      entityId: productionAliasId,
      changes: {
        hostname: promotion.hostname,
        previousDeploymentId: promotion.previousDeploymentId,
        deploymentId: promotion.deploymentId,
      },
      metadata: {
        requestId: request.id,
        previewHostname: promotion.previewHostname,
        requestedByUserId: request.requestedByUserId,
        appliedByUserId: access.session.user.id,
      },
    });
  }));

  redirect(`/app/${access.tenant.slug}/projects/${access.project.slug}/deploy?promotion=completed`);
}

export async function executeApprovedDeploymentRequest(formData: FormData) {
  return executeApprovedRequest(formData, false);
}

export async function executeApprovedCustomerDeploymentRequest(formData: FormData) {
  return executeApprovedRequest(formData, true);
}

/** @jest-environment node */

import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();

async function read(relativePath: string) {
  return readFile(path.join(root, relativePath), 'utf8');
}

describe('APP-07 deployment approval boundary', () => {
  it('keeps requests scoped to tenant, project, application and environment with immutable refs', async () => {
    const schema = await read('src/shared/db/schema/deployment-requests.ts');

    expect(schema).toContain("tenantId: uuid('tenant_id').notNull()");
    expect(schema).toContain("projectId: uuid('project_id').notNull()");
    expect(schema).toContain("applicationId: uuid('application_id').notNull()");
    expect(schema).toContain("environmentId: uuid('environment_id').notNull()");
    expect(schema).toContain("releaseRef: text('release_ref').notNull()");
    expect(schema).toContain("executionDeploymentId: uuid('execution_deployment_id')");
  });

  it('requires manager access and Deploy entitlement to request and execute', async () => {
    const actions = await read('src/features/deploy/actions.ts');

    expect(actions).toContain('requireDeployManager');
    expect(actions).toContain("entitlement: 'workspace.deploy'");
    expect(actions).toContain('createDeploymentRequest');
    expect(actions).toContain('executeApprovedDeploymentRequest');
  });

  it('blocks production and protected environments at request and execution time', async () => {
    const actions = await read('src/features/deploy/actions.ts');

    expect(actions).toContain("environment.protected || environment.kind === 'production'");
    expect(actions).toContain('Production and protected environments cannot be requested.');
    expect(actions).toContain('Production and protected environments cannot be executed.');
  });

  it('requires Platform Control authority to approve or reject', async () => {
    const review = await read('src/features/deploy/request-actions.ts');
    const page = await read('src/app/(tenant)/t/[tenant]/admin/platform-control/[module]/page.tsx');

    expect(review).toContain('requirePlatformControlAccess(tenantSlug)');
    expect(review).toContain("requirePermission(tenantSlug, 'platform:deployments')");
    expect(review).toContain("eq(deploymentRequests.status, 'pending')");
    expect(page).toContain('DeploymentApprovalQueue');
  });

  it('atomically binds one approved request to one queued deployment before provider execution', async () => {
    const actions = await read('src/features/deploy/actions.ts');
    const service = await read('src/features/deploy/server/execution/service.ts');

    expect(actions).toContain('db.transaction(async (tx)');
    expect(actions).toContain("eq(deploymentRequests.status, 'approved')");
    expect(actions).toContain('isNull(deploymentRequests.executionDeploymentId)');
    expect(actions).toContain("status: 'queued'");
    expect(actions).toContain("status: 'executing'");
    expect(actions).toContain('executionDeploymentId: deployment.id');
    expect(actions).toContain('releaseRef: request.releaseRef');
    expect(actions).toContain('sourceRef: request.sourceRef');
    expect(actions).toContain('{ queuedDeploymentId: claimed.deploymentId }');
    expect(service).toContain('options.queuedDeploymentId');
  });

  it('keeps the Platform Control deployment module on the implemented approval route', async () => {
    const registry = await read('src/features/platform-app-experience/control-center-registry.ts');
    const deployBlock = registry.slice(
      registry.indexOf("key: 'deployments-domains'"),
      registry.indexOf("key: 'domains-routing'"),
    );

    expect(deployBlock).toContain("href: '/admin/platform-control/deployments-domains'");
    expect(deployBlock).toContain("status: 'foundation'");
    expect(deployBlock).toContain('candidate deployment approvals');
    expect(deployBlock).toContain('production execution');
  });

  it('keeps execution isolated from production, DNS, custom domains and rollback', async () => {
    const panel = await read('src/features/deploy/components/DeployFoundationPanel.tsx');
    const actions = await read('src/features/deploy/actions.ts');

    expect(panel).toContain('Production, DNS and custom domains stay blocked');
    expect(actions).not.toContain('customHostname');
    expect(actions).not.toContain('rollbackDeployment');
    expect(actions).not.toContain('deployProduction');
  });

  it('keeps migration 0015 additive', async () => {
    const migration = await read('src/shared/db/migrations/0015_deployment_requests.sql');

    expect(migration).toContain('"saas_template"."deployment_requests"');
    expect(migration).toContain('"release_ref" text NOT NULL');
    expect(migration).not.toMatch(/DROP TABLE|DROP SCHEMA|TRUNCATE/i);
  });
});

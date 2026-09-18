/** @jest-environment node */

import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();

async function read(relativePath: string) {
  return readFile(path.join(root, relativePath), 'utf8');
}

describe('Deploy request approval boundary', () => {
  it('keeps deployment requests tenant/project/application/environment scoped', async () => {
    const schema = await read('src/shared/db/schema/deployment-requests.ts');

    expect(schema).toContain("tenantId: uuid('tenant_id').notNull()");
    expect(schema).toContain("projectId: uuid('project_id').notNull()");
    expect(schema).toContain("applicationId: uuid('application_id').notNull()");
    expect(schema).toContain("environmentId: uuid('environment_id').notNull()");
    expect(schema).toContain("status: varchar('status', { length: 32 }).notNull().default('pending')");
  });

  it('allows only project managers to request and blocks protected production environments', async () => {
    const actions = await read('src/features/deploy/request-actions.ts');

    expect(actions).toContain('requireProjectAccess');
    expect(actions).toContain('if (!access.canManage)');
    expect(actions).toContain("environment.protected || environment.kind === 'production'");
    expect(actions).toContain("status: 'pending'");
  });

  it('requires deployment-specific platform authority to approve or reject', async () => {
    const actions = await read('src/features/deploy/request-actions.ts');
    const page = await read('src/app/(tenant)/t/[tenant]/admin/platform-control/[module]/page.tsx');

    expect(actions).toContain("requirePermission(tenantSlug, 'platform:deployments')");
    expect(page).toContain("requirePermission(tenant, 'platform:deployments')");
    expect(actions).toContain("eq(deploymentRequests.status, 'pending')");
  });

  it('records approval only and does not invoke provider execution', async () => {
    const actions = await read('src/features/deploy/request-actions.ts');
    const queue = await read('src/features/deploy/components/DeploymentApprovalQueue.tsx');

    expect(actions).not.toContain('executeDeployment');
    expect(actions).not.toContain('createCloudflareCandidateAdapter');
    expect(actions).not.toContain('CloudflareCandidateApiTransport');
    expect(queue).toContain('Approval records intent and reviewer identity only.');
  });

  it('keeps migration 0015 additive', async () => {
    const migration = await read('src/shared/db/migrations/0015_deployment_requests.sql');

    expect(migration).toContain('"saas_template"."deployment_requests"');
    expect(migration).not.toMatch(/DROP TABLE|DROP SCHEMA|TRUNCATE/i);
  });
});

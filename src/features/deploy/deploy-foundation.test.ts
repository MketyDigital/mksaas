/** @jest-environment node */

import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();

async function read(relativePath: string) {
  return readFile(path.join(root, relativePath), 'utf8');
}

describe('Deploy foundation safety contract', () => {
  it('keeps reads tenant and project scoped', async () => {
    const source = await read('src/features/deploy/server/queries.ts');

    expect(source).toContain('eq(deployApplications.tenantId, tenantId)');
    expect(source).toContain('eq(deployApplications.projectId, projectId)');
    expect(source).toContain('eq(deployEnvironments.tenantId, tenantId)');
    expect(source).toContain('eq(deployments.projectId, projectId)');
  });

  it('allows only project managers to create metadata', async () => {
    const actions = await read('src/features/deploy/actions.ts');

    expect(actions).toContain('requireProjectAccess');
    expect(actions).toContain('if (!access.canManage)');
    expect(actions).toContain("protected: kind === 'production'");
  });

  it('exposes only the guarded non-production customer candidate execution path', async () => {
    const files = await Promise.all([
      read('src/features/deploy/actions.ts'),
      read('src/features/deploy/server/queries.ts'),
      read('src/features/deploy/components/DeployFoundationPanel.tsx'),
    ]);
    const source = files.join('\n');

    expect(source).toContain('createDeploymentRequest');
    expect(source).toContain('executeApprovedDeploymentRequest');
    expect(source).toContain("entitlement: 'workspace.deploy'");
    expect(source).toContain("environment.kind === 'production'");
    expect(source).toContain('environment.protected');
    expect(source).toContain('isolated workers.dev proof deployment');
    expect(source).toContain('No infrastructure is provisioned');
    expect(source).not.toMatch(/oci api|coolify|Deploy to production|Create custom domain|bind_pattern/i);
  });
});

/** @jest-environment node */

import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ACTIONS = path.resolve(process.cwd(), 'src/features/deploy/actions.ts');
const PANEL = path.resolve(process.cwd(), 'src/features/deploy/components/DeployFoundationPanel.tsx');
const CANDIDATE_WORKFLOW = path.resolve(process.cwd(), '.github/workflows/mkety-public-candidate-deploy.yml');
const PRODUCTION_WORKFLOW = path.resolve(process.cwd(), '.github/workflows/mkety-public-production-cutover.yml');

describe('APP-07 customer candidate invocation boundary', () => {
  it('requires manager access, Deploy entitlement and non-production environment before execution', async () => {
    const actions = await readFile(ACTIONS, 'utf8');

    expect(actions).toContain('requireDeployManager');
    expect(actions).toContain("entitlement: 'workspace.deploy'");
    expect(actions).toContain("environment.kind === 'production'");
    expect(actions).toContain('environment.protected');
    expect(actions).toContain('createDeploymentRequest');
    expect(actions).toContain('executeApprovedDeploymentRequest');
    expect(actions).toContain('executionDeploymentId');
    expect(actions).toContain('drizzleDeploymentExecutionRepository');
    expect(actions).toContain('executeDeployment');
    expect(actions).toContain('createCustomerCandidateProvider');
  });

  it('exposes only isolated candidate execution in the customer UI', async () => {
    const panel = await readFile(PANEL, 'utf8');

    expect(panel).toContain('Request non-production candidate');
    expect(panel).toContain('isolated workers.dev proof execution');
    expect(panel).toContain('Production, DNS and custom domains stay blocked');
    expect(panel).toContain('Execute approved candidate');
    expect(panel).not.toContain('Deploy to production');
    expect(panel).not.toContain('Create custom domain');
  });

  it('uses dedicated runtime secret names in candidate and production workers', async () => {
    for (const workflowPath of [CANDIDATE_WORKFLOW, PRODUCTION_WORKFLOW]) {
      const workflow = await readFile(workflowPath, 'utf8');
      expect(workflow).toContain('put_secret MKETY_DEPLOY_CLOUDFLARE_API_TOKEN "$CLOUDFLARE_API_TOKEN"');
      expect(workflow).toContain('put_secret MKETY_DEPLOY_CLOUDFLARE_ACCOUNT_ID "$CLOUDFLARE_ACCOUNT_ID"');
    }
  });
});

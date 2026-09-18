/** @jest-environment node */

import { readFile } from 'node:fs/promises';
import path from 'node:path';

const WORKFLOW_PATH = path.resolve(process.cwd(), '.github/workflows/mkety-public-production-cutover.yml');
const CERTIFY_LAUNCHER_PATH = path.resolve(
  process.cwd(),
  '.github/workflows/mkety-certify-candidate-launcher.yml',
);

describe('production cutover private database gate', () => {
  it('authorizes the exact certified release before private DB mutation and route cutover', async () => {
    const workflow = await readFile(WORKFLOW_PATH, 'utf8');

    expect(workflow).toContain('authorize:');
    expect(workflow).toContain("CONFIRMATION != 'CUTOVER MKETY PUBLIC'");
    expect(workflow).toContain("verify_workflow_success 'tests.yml' 'tests'");
    expect(workflow).toContain("verify_workflow_success 'type-check.yml' 'typecheck'");
    expect(workflow).toContain("verify_workflow_success 'lint.yml' 'lint'");
    expect(workflow).toContain("verify_workflow_success 'build.yml' 'build'");
    expect(workflow).toContain("verify_workflow_success 'ci.yml' 'CI'");
    expect(workflow).toContain("verify_workflow_success 'mkety-cloudflare-vinext-smoke.yml' 'Cloudflare vinext smoke'");
    expect(workflow).toContain("verify_workflow_success 'mkety-content-db-smoke.yml' 'content DB smoke'");
    expect(workflow).toContain("verify_workflow_success 'mkety-public-ai-runtime-diagnostic.yml' 'Public AI runtime diagnostic'");
    expect(workflow).toContain("verify_workflow_success 'mkety-production-preflight.yml' 'production routing preflight'");
    expect(workflow).toContain("verify_workflow_success 'mkety-public-candidate-deploy.yml' 'public candidate'");

    expect(workflow).toContain('production-db:');
    expect(workflow).toContain('needs: authorize');
    expect(workflow).toContain('uses: ./.github/workflows/mkety-coolify-production-db-executor.yml');
    expect(workflow).toContain('verified_sha: ${{ inputs.verified_sha }}');
    expect(workflow).toContain('COOLIFY_TOKEN: ${{ secrets.COOLIFY_TOKEN }}');
    expect(workflow).not.toContain('PRODUCTION_DATABASE_URL: ${{ secrets.PRODUCTION_DATABASE_URL }}');

    expect(workflow).toContain('needs: production-db');
    expect(workflow).toContain('runs-on: ubuntu-latest');
    expect(workflow).not.toContain('Migrate, seed, and smoke production content database');
    expect(workflow).not.toContain('pnpm db:migrate\\n');

    // Production promotion uses Cloudflare Worker Custom Domains, never apex/www Worker Routes.
    expect(workflow).toContain('/accounts/$CLOUDFLARE_ACCOUNT_ID/workers/domains');
    expect(workflow).toContain('Attach apex and www as Worker Custom Domains');
    expect(workflow).toContain('for host in mkety.com www.mkety.com');
    expect(workflow).toContain('service:process.env.PRODUCTION_WORKER_NAME');
    expect(workflow).toContain('Verify unrelated Worker Routes remain unchanged');
    expect(workflow).not.toContain('Bind only apex and www Worker routes');
    expect(workflow).not.toContain("bind_pattern 'mkety.com/*'");
    expect(workflow).not.toContain("bind_pattern 'www.mkety.com/*'");
  });

  it('pins candidate certification to the exact current public release SHA', async () => {
    const workflow = await readFile(CERTIFY_LAUNCHER_PATH, 'utf8');

    expect(workflow).toContain('CANDIDATE_SHA: 2e871fe5ba51585886713c2cb79544e68dc20b73');
    expect(workflow).toContain('CERT_BRANCH: certify/2e871fe');
    expect(workflow).toContain("dispatch 'mkety-content-db-smoke.yml'");
    expect(workflow).toContain("dispatch 'mkety-public-ai-runtime-diagnostic.yml'");
    expect(workflow).toContain("dispatch 'mkety-production-preflight.yml'");
    expect(workflow).toContain("dispatch 'mkety-public-candidate-deploy.yml'");
  });
});

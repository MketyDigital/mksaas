/** @jest-environment node */

import { readFile } from 'node:fs/promises';
import path from 'node:path';

const WORKFLOW_PATH = path.resolve(process.cwd(), '.github/workflows/mkety-public-production-cutover.yml');
const PRIVATE_DB_EXECUTOR_PATH = path.resolve(
  process.cwd(),
  '.github/workflows/mkety-coolify-production-db-executor.yml',
);
const CANDIDATE_PATH = path.resolve(
  process.cwd(),
  '.github/workflows/mkety-public-candidate-deploy.yml',
);

describe('production cutover private database gate', () => {
  it('authorizes one exact integrated candidate before private DB mutation and Custom Domain deploy', async () => {
    const workflow = await readFile(WORKFLOW_PATH, 'utf8');

    expect(workflow).toContain('authorize:');
    expect(workflow).toContain("CONFIRMATION != 'CUTOVER MKETY PUBLIC'");
    expect(workflow).toContain("verify_workflow_success 'ci.yml' 'CI'");
    expect(workflow).toContain(
      "verify_workflow_success 'mkety-public-candidate-deploy.yml' 'integrated public candidate'",
    );
    expect(workflow).not.toContain("verify_workflow_success 'mkety-content-db-smoke.yml'");
    expect(workflow).not.toContain("verify_workflow_success 'mkety-public-ai-runtime-diagnostic.yml'");
    expect(workflow).not.toContain("verify_workflow_success 'mkety-production-preflight.yml'");
    expect(workflow).not.toContain('Re-run exact-SHA quality gate');

    expect(workflow).toContain(
      "MKETY_PLATFORM_CONTROL_TENANT_SLUG: ${{ secrets.MKETY_PLATFORM_CONTROL_TENANT_SLUG || vars.MKETY_PLATFORM_CONTROL_TENANT_SLUG || 'mkety-ops' }}",
    );
    expect(workflow).toContain(
      "MKETY_PLATFORM_ADMIN_EMAILS: ${{ secrets.MKETY_PLATFORM_ADMIN_EMAILS || 'support@mkety.com,hello@mkety.com' }}",
    );
    expect(workflow).toContain(
      'MKETY_MEDIA_FLUTTERWAVE_WEBHOOK_URL: ${{ secrets.MKETY_MEDIA_FLUTTERWAVE_WEBHOOK_URL || vars.MKETY_MEDIA_FLUTTERWAVE_WEBHOOK_URL }}',
    );
    expect(workflow).not.toContain('environment: production');

    expect(workflow).toContain('production-db:');
    expect(workflow).toContain('needs: authorize');
    expect(workflow).toContain('uses: ./.github/workflows/mkety-coolify-production-db-executor.yml');
    expect(workflow).toContain('verified_sha: ${{ inputs.verified_sha }}');
    expect(workflow).toContain('COOLIFY_TOKEN: ${{ secrets.COOLIFY_TOKEN }}');
    expect(workflow).not.toContain('PRODUCTION_DATABASE_URL: ${{ secrets.PRODUCTION_DATABASE_URL }}');

    expect(workflow).toContain('needs: production-db');
    expect(workflow).toContain('Verify Mkety Auth bindings survived production redeploy');
    expect(workflow).toContain("'MKETY_AUTH_PROVIDER'");
    expect(workflow).toContain("'MKETY_AUTH_SESSION_SECRET'");
    expect(workflow).toContain("'NEXT_PUBLIC_APP_URL'");

    expect(workflow).toContain('/accounts/$CLOUDFLARE_ACCOUNT_ID/workers/domains');
    expect(workflow).toContain('Attach apex and www as Worker Custom Domains');
    expect(workflow).toContain('Business\\s+(?:plan|tier|workspace)');
    expect(workflow).not.toContain('\\b(Growth|Pro|Business)\\b');
    expect(workflow).toContain('for host in mkety.com www.mkety.com');
    expect(workflow).toContain('service:process.env.PRODUCTION_WORKER_NAME');
    expect(workflow).toContain('Verify unrelated Worker Routes remain unchanged');
    expect(workflow).not.toContain('Bind only apex and www Worker routes');
    expect(workflow).not.toContain("bind_pattern 'mkety.com/*'");
    expect(workflow).not.toContain("bind_pattern 'www.mkety.com/*'");
  });

  it('keeps the integrated candidate as the detailed certification boundary', async () => {
    const workflow = await readFile(CANDIDATE_PATH, 'utf8');

    expect(workflow).not.toContain('environment: staging');
    expect(workflow).toContain('Run tests');
    expect(workflow).toContain('Run type-check');
    expect(workflow).toContain('Run lint');
    expect(workflow).toContain('Check vinext compatibility');
    expect(workflow).toContain('Apply and verify connected Mkety content database');
    expect(workflow).toContain('Verify NOWPayments API key without creating a payment');
    expect(workflow).toContain('Deploy isolated candidate Worker');
    expect(workflow).toContain('Smoke candidate public routes and production copy');
    expect(workflow).toContain('Smoke Enterprise payment safety boundary');
    expect(workflow).toContain('Smoke Public Mkety AI memory support and privacy boundary');
    expect(workflow).toContain(
      'MKETY_MEDIA_FLUTTERWAVE_WEBHOOK_URL: ${{ secrets.MKETY_MEDIA_FLUTTERWAVE_WEBHOOK_URL || vars.MKETY_MEDIA_FLUTTERWAVE_WEBHOOK_URL }}',
    );
  });

  it('upserts and verifies the Coolify migration secret without blindly replaying creates', async () => {
    const workflow = await readFile(PRIVATE_DB_EXECUTOR_PATH, 'utf8');

    expect(workflow).not.toContain('environment: production');
    expect(workflow).toContain('List current migration environment');
    expect(workflow).toContain('create_database_env');
    expect(workflow).toContain('update_database_env');
    expect(workflow).toContain('verify_database_env');
    expect(workflow).toContain('-X POST');
    expect(workflow).toContain('-X PATCH');
    expect(workflow).toContain('--retry 4');
    expect(workflow).toContain('--retry-all-errors');
    expect(workflow).toContain('--retry-delay 2');
    expect(workflow).toContain('for attempt in $(seq 1 5)');
    expect(workflow).toContain('Database secret exists after uncertain create response');
    expect(workflow).toContain('$base/applications/$APP_UUID/envs');
  });
});

/** @jest-environment node */

import { readFile } from 'node:fs/promises';
import path from 'node:path';

const WORKFLOW_PATH = path.resolve(process.cwd(), '.github/workflows/mkety-production-db-protection.yml');

describe('production database protection workflow', () => {
  it('verifies private Postgres and fresh dedicated-R2 backups without mutating production', async () => {
    const workflow = await readFile(WORKFLOW_PATH, 'utf8');

    expect(workflow).toContain("cron: '15 3 * * *'");
    expect(workflow).toContain('R2_ACCESS_KEY_ID: ${{ secrets.R2_ACCESS_KEY_ID }}');
    expect(workflow).toContain('R2_SECRET_ACCESS_KEY: ${{ secrets.R2_SECRET_ACCESS_KEY }}');
    expect(workflow).toContain('R2_S3_API: ${{ secrets.R2_S3_API }}');
    expect(workflow).toContain('R2_BUCKET: mkety-production-db-backups');
    expect(workflow).toContain("db.is_public !== false");
    expect(workflow).toContain("backup.save_s3 !== true");
    expect(workflow).toContain('database_backup_retention_amount_s3');
    expect(workflow).toContain('30 * 60 * 60 * 1000');
    expect(workflow).toContain('aws s3api list-objects-v2');
    expect(workflow).not.toContain('-X PATCH');
    expect(workflow).not.toContain('-X POST');
  });
});

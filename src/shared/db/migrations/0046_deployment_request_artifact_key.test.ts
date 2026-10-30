/** @jest-environment node */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';

const migration = resolve(process.cwd(), 'src/shared/db/migrations/0046_deployment_request_artifact_key.sql');

describe('deployment request artifact migration', () => {
  it('adds an optional artifact key without rewriting existing requests', async () => {
    const database = new PGlite();
    try {
      await database.exec(`CREATE SCHEMA saas_template;
        CREATE TABLE saas_template.deployment_requests (id uuid PRIMARY KEY, release_ref text NOT NULL);
        INSERT INTO saas_template.deployment_requests VALUES ('00000000-0000-0000-0000-000000000001', 'release-1');`);
      await database.exec(readFileSync(migration, 'utf8'));
      const result = await database.query('SELECT release_ref, artifact_key, artifact_sha256 FROM saas_template.deployment_requests');
      expect(result.rows).toEqual([{ release_ref: 'release-1', artifact_key: null, artifact_sha256: null }]);
      await database.query(`INSERT INTO saas_template.deployment_requests (id, release_ref, artifact_key)
        VALUES ('00000000-0000-0000-0000-000000000002', 'release-2', 'mkety-deploy-artifacts/t/p/r/artifact.json')`);
    } finally {
      await database.close();
    }
  });
});

/** @jest-environment node */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';

const migration = resolve(process.cwd(), 'src/shared/db/migrations/0049_deployment_production_alias_promotion.sql');

describe('deployment production alias promotion migration', () => {
  it('adds an optional completed-deployment reference without rewriting existing requests', async () => {
    const database = new PGlite();
    try {
      await database.exec(`CREATE SCHEMA saas_template;
        CREATE TABLE saas_template.deployments (id uuid PRIMARY KEY);
        CREATE TABLE saas_template.deployment_requests (
          id uuid PRIMARY KEY,
          release_ref text NOT NULL,
          status text NOT NULL
        );
        INSERT INTO saas_template.deployment_requests VALUES
          ('00000000-0000-0000-0000-000000000001', 'release-1', 'completed');`);
      await database.exec(readFileSync(migration, 'utf8'));
      await database.exec(`INSERT INTO saas_template.deployments VALUES
        ('00000000-0000-0000-0000-000000000002');
        INSERT INTO saas_template.deployment_requests (id, release_ref, status, promotion_deployment_id)
        VALUES ('00000000-0000-0000-0000-000000000003', 'release-2', 'pending',
          '00000000-0000-0000-0000-000000000002');`);

      const requests = await database.query(`SELECT id, release_ref, status, promotion_deployment_id
        FROM saas_template.deployment_requests ORDER BY id`);
      expect(requests.rows).toEqual([
        { id: '00000000-0000-0000-0000-000000000001', release_ref: 'release-1', status: 'completed', promotion_deployment_id: null },
        { id: '00000000-0000-0000-0000-000000000003', release_ref: 'release-2', status: 'pending', promotion_deployment_id: '00000000-0000-0000-0000-000000000002' },
      ]);

      await expect(database.exec(`INSERT INTO saas_template.deployment_requests (id, release_ref, status, promotion_deployment_id)
        VALUES ('00000000-0000-0000-0000-000000000004', 'release-3', 'pending',
          '00000000-0000-0000-0000-000000000099');`)).rejects.toThrow();
      await database.exec(`DELETE FROM saas_template.deployments
        WHERE id = '00000000-0000-0000-0000-000000000002';`);
      const afterDelete = await database.query(`SELECT promotion_deployment_id
        FROM saas_template.deployment_requests
        WHERE id = '00000000-0000-0000-0000-000000000003';`);
      expect(afterDelete.rows).toEqual([{ promotion_deployment_id: null }]);
    } finally {
      await database.close();
    }
  });
});

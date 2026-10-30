/** @jest-environment node */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';

const migrationPath = resolve(process.cwd(), 'src/shared/db/migrations/0045_deployment_hostnames.sql');

describe('deployment hostname ownership migration', () => {
  it('enforces canonical names, ownership, lifecycle values, and completed deployment activation', async () => {
    expect(existsSync(migrationPath)).toBe(true);
    const database = new PGlite();
    try {
      await database.exec(`
        CREATE SCHEMA saas_template;
        CREATE TABLE saas_template.tenants (id uuid PRIMARY KEY);
        CREATE TABLE saas_template.projects (id uuid PRIMARY KEY);
        CREATE TABLE saas_template.users (id text PRIMARY KEY);
        CREATE TABLE saas_template.deploy_applications (
          id uuid PRIMARY KEY, tenant_id uuid NOT NULL, project_id uuid NOT NULL
        );
        CREATE TABLE saas_template.deploy_environments (
          id uuid PRIMARY KEY, tenant_id uuid NOT NULL, project_id uuid NOT NULL, application_id uuid NOT NULL
        );
        CREATE TABLE saas_template.deployments (
          id uuid PRIMARY KEY, tenant_id uuid NOT NULL, project_id uuid NOT NULL,
          application_id uuid NOT NULL, environment_id uuid NOT NULL,
          status varchar(32) NOT NULL, provider_deployment_ref text
        );
        INSERT INTO saas_template.tenants VALUES ('00000000-0000-0000-0000-000000000001');
        INSERT INTO saas_template.tenants VALUES ('00000000-0000-0000-0000-000000000009');
        INSERT INTO saas_template.projects VALUES ('00000000-0000-0000-0000-000000000002');
        INSERT INTO saas_template.deploy_applications VALUES (
          '00000000-0000-0000-0000-000000000003',
          '00000000-0000-0000-0000-000000000001',
          '00000000-0000-0000-0000-000000000002'
        );
        INSERT INTO saas_template.deploy_environments VALUES (
          '00000000-0000-0000-0000-000000000004',
          '00000000-0000-0000-0000-000000000001',
          '00000000-0000-0000-0000-000000000002',
          '00000000-0000-0000-0000-000000000003'
        );
        INSERT INTO saas_template.deployments VALUES (
          '00000000-0000-0000-0000-000000000005',
          '00000000-0000-0000-0000-000000000001',
          '00000000-0000-0000-0000-000000000002',
          '00000000-0000-0000-0000-000000000003',
          '00000000-0000-0000-0000-000000000004',
          'queued', NULL
        );
      `);
      await database.exec(readFileSync(migrationPath, 'utf8'));

      const id = '00000000-0000-0000-0000-000000000005';
      await expect(database.query(`INSERT INTO saas_template.deployment_hostnames
        (hostname, tenant_id, project_id, application_id, environment_id, deployment_id, kind, status)
        VALUES ('app.mkety.app', '00000000-0000-0000-0000-000000000001',
          '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003',
          '00000000-0000-0000-0000-000000000004', '${id}', 'preview', 'pending')`)).rejects.toThrow();

      await expect(database.query(`INSERT INTO saas_template.deployment_hostnames
        (hostname, tenant_id, project_id, application_id, environment_id, deployment_id, kind, status)
        VALUES ('demo.mkety.app', '00000000-0000-0000-0000-000000000009',
          '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003',
          '00000000-0000-0000-0000-000000000004', '${id}', 'preview', 'pending')`)).rejects.toThrow();

      await database.query(`INSERT INTO saas_template.deployment_hostnames
        (hostname, tenant_id, project_id, application_id, environment_id, deployment_id, kind, status)
        VALUES ('demo.mkety.app', '00000000-0000-0000-0000-000000000001',
          '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003',
          '00000000-0000-0000-0000-000000000004', '${id}', 'preview', 'pending')`);
      await expect(database.query(`UPDATE saas_template.deployment_hostnames SET status = 'active'`)).rejects.toThrow();

      await database.query(`UPDATE saas_template.deployments SET status = 'completed', provider_deployment_ref = 'safe-worker-ref' WHERE id = '${id}'`);
      await database.query(`UPDATE saas_template.deployment_hostnames SET status = 'active'`);
      await expect(database.query(`INSERT INTO saas_template.deployment_hostnames
        (hostname, tenant_id, project_id, application_id, environment_id, deployment_id, kind, status)
        VALUES ('demo.mkety.app', '00000000-0000-0000-0000-000000000001',
          '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003',
          '00000000-0000-0000-0000-000000000004', '${id}', 'preview', 'active')`)).rejects.toThrow();
    } finally {
      await database.close();
    }
  });
});

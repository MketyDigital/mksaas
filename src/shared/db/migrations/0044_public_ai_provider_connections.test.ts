/** @jest-environment node */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';

const migrationPath = resolve(process.cwd(), 'src/shared/db/migrations/0044_public_ai_provider_connections.sql');

describe('public AI provider connection consolidation migration', () => {
  it('promotes legacy Public credentials and preserves an existing platform credential', async () => {
    const migrationExists = existsSync(migrationPath);
    expect(migrationExists).toBe(true);
    if (!migrationExists) return;

    const database = new PGlite();
    try {
      await database.exec(`
        CREATE SCHEMA saas_template;
        CREATE TABLE saas_template.ai_provider_connections (
          id uuid PRIMARY KEY,
          tenant_id uuid,
          project_id uuid,
          provider_key varchar(64) NOT NULL,
          mode varchar(24) NOT NULL,
          secret_ref text,
          updated_at timestamptz NOT NULL
        );
        INSERT INTO saas_template.ai_provider_connections (id, provider_key, mode, secret_ref, updated_at) VALUES
          ('00000000-0000-0000-0000-000000000001', 'azure-openai', 'public', 'legacy-azure-secret', '2026-10-20T00:00:00Z'),
          ('00000000-0000-0000-0000-000000000002', 'openai', 'public', 'legacy-openai-secret', '2026-10-20T00:00:00Z'),
          ('00000000-0000-0000-0000-000000000003', 'openai', 'platform', 'platform-openai-secret', '2026-10-21T00:00:00Z');
      `);

      await database.exec(readFileSync(migrationPath, 'utf8'));

      const { rows } = await database.query<{ provider_key: string; mode: string; secret_ref: string }>(`
        SELECT provider_key, mode, secret_ref
        FROM saas_template.ai_provider_connections
        ORDER BY provider_key, mode
      `);

      expect(rows).toEqual([
        { provider_key: 'azure-openai', mode: 'platform', secret_ref: 'legacy-azure-secret' },
        { provider_key: 'openai', mode: 'platform', secret_ref: 'platform-openai-secret' },
      ]);
    } finally {
      await database.close();
    }
  });
});

// Re-run the candidate migration baseline when this Public AI release is revalidated.

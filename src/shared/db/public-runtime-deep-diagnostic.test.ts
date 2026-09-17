/** @jest-environment node */

import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { evaluateStructuredProbe } from '../../../scripts/public-assistant-production-diagnostic';

const WORKFLOW_PATH = path.resolve(
  process.cwd(),
  '.github/workflows/mkety-prod-hyperdrive-deep-diagnostic.yml',
);

describe('production runtime deep diagnostic', () => {
  it('compares the explicit Cloudflare resolver with the aliased resolver before database wrappers', async () => {
    const workflow = await readFile(WORKFLOW_PATH, 'utf8');

    expect(workflow).toContain('/api/runtime-db-diagnostic');
    expect(workflow).not.toContain('/api/_diagnostics/runtime-db');
    expect(workflow).toContain("import { env } from 'cloudflare:workers'");
    expect(workflow).toContain(
      "from '@/shared/db/runtime-connection.cloudflare'",
    );
    expect(workflow).toContain('getExplicitCloudflareRuntimeDatabaseConnectionString');
    expect(workflow).toContain("stage: 'cloudflare-binding'");
    expect(workflow).toContain('hasBinding');
    expect(workflow).toContain('hasConnectionString');
    expect(workflow).toContain('explicit-cloudflare-resolver');
    expect(workflow).toContain('runtime-adapter-identity');
    expect(workflow).toContain('aliasedRuntimeConnectionAdapterKind');
    expect(workflow).toContain('runtime-resolver');
    expect(workflow).toContain('request-database');
    expect(workflow).toContain('singleton-database');
    expect(workflow).toContain('RUNTIME_DB_DIAGNOSTIC');
  });

  it('retries a transient generic 500 instead of treating it as a probe result', () => {
    expect(evaluateStructuredProbe('500', 'Internal Server Error')).toEqual({
      ready: false,
      ok: false,
      httpCode: 500,
      stage: null,
    });
  });

  it('stops on a structured probe failure so the real database error can fail closed', () => {
    expect(
      evaluateStructuredProbe(
        '500',
        JSON.stringify({ ok: false, stage: 'query', name: 'PostgresError' }),
      ),
    ).toEqual({ ready: true, ok: false, httpCode: 500, stage: 'query' });
  });

  it('passes only on a structured successful query response', () => {
    expect(
      evaluateStructuredProbe('200', JSON.stringify({ ok: true, stage: 'query' })),
    ).toEqual({ ready: true, ok: true, httpCode: 200, stage: 'query' });
  });
});

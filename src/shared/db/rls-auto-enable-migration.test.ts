/** @jest-environment node */

import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();

async function read(relativePath: string) {
  return readFile(path.join(root, relativePath), 'utf8');
}

describe('RLS auto-enable hardening migration', () => {
  it('is a safe no-op when the optional helper or Supabase roles are absent', async () => {
    const migration = await read('migrations/0008_harden_rls_auto_enable.sql');

    expect(migration).toContain("to_regprocedure('public.rls_auto_enable()')");
    expect(migration).toMatch(/IF\s+.*rls_auto_enable.*IS NOT NULL/is);
    expect(migration).toContain("rolname = 'anon'");
    expect(migration).toContain("rolname = 'authenticated'");
  });

  it('still revokes external execution when the optional helper and roles exist', async () => {
    const migration = await read('migrations/0008_harden_rls_auto_enable.sql');

    expect(migration).toContain(
      'REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC',
    );
    expect(migration).toContain(
      'REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon',
    );
    expect(migration).toContain(
      'REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM authenticated',
    );
  });
});

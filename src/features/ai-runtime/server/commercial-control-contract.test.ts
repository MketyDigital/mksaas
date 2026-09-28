import { readFile } from 'node:fs/promises';

describe('Enterprise AI commercial control contract', () => {
  it('keeps prepaid-only enforcement in schema, migration, and admin writes', async () => {
    const [schema, migration, actions] = await Promise.all([
      readFile('src/shared/db/schema/ai-runtime.ts', 'utf8'),
      readFile('src/shared/db/migrations/0024_ai_commercial_control.sql', 'utf8'),
      readFile('src/features/ai-runtime/server/commercial-admin-actions.ts', 'utf8'),
    ]);

    expect(schema).toContain("ai_runtime_policies_prepaid_only_check");
    expect(migration).toContain('CHECK ("prepaid_only" = true)');
    expect(actions).toContain('prepaidOnly: true');
    expect(actions).not.toContain('prepaidOnly: false');
  });

  it('does not expose an admin action that directly enables customer inference', async () => {
    const actions = await readFile(
      'src/features/ai-runtime/server/commercial-admin-actions.ts',
      'utf8',
    );

    expect(actions).toContain('disableEnterpriseAiInference');
    expect(actions).not.toContain('enableEnterpriseAiInference');
  });

  it('exposes AI Operations as a guarded Platform Control module', async () => {
    const registry = await readFile(
      'src/features/platform-app-experience/control-center-registry.ts',
      'utf8',
    );

    expect(registry).toContain("key: 'ai-operations'");
    expect(registry).toContain("requiredPermission: 'platform:plans'");
    expect(registry).toContain('postpaid overage enablement');
    expect(registry).toContain('historical rate mutation');
  });
});

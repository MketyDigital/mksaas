import { buildAiExactCacheKey } from './cache-key';

const base = {
  tenantId: 'tenant-a',
  projectId: 'project-a',
  agentVersion: 'agent-v4',
  modelRouteVersion: 'route-v2',
  systemInstructionsHash: 'system-hash',
  normalizedInputHash: 'input-hash',
  toolKnowledgeVersion: 'knowledge-v7',
  safetyPolicyVersion: 'safety-v3',
  locale: 'en',
};

describe('AI exact cache keys', () => {
  it('is deterministic for the same tenant-scoped request identity', async () => {
    await expect(buildAiExactCacheKey(base)).resolves.toBe(await buildAiExactCacheKey(base));
  });

  it('cannot collide across tenants with otherwise identical input', async () => {
    const tenantA = await buildAiExactCacheKey(base);
    const tenantB = await buildAiExactCacheKey({ ...base, tenantId: 'tenant-b' });
    expect(tenantA).not.toBe(tenantB);
    expect(tenantA).toContain('tenant-a');
    expect(tenantB).toContain('tenant-b');
  });

  it('changes when route, knowledge, policy, project, agent or locale changes', async () => {
    const original = await buildAiExactCacheKey(base);
    const variants = [
      { ...base, projectId: 'project-b' },
      { ...base, agentVersion: 'agent-v5' },
      { ...base, modelRouteVersion: 'route-v3' },
      { ...base, toolKnowledgeVersion: 'knowledge-v8' },
      { ...base, safetyPolicyVersion: 'safety-v4' },
      { ...base, locale: 'fr' },
    ];

    for (const variant of variants) {
      await expect(buildAiExactCacheKey(variant)).resolves.not.toBe(original);
    }
  });
});

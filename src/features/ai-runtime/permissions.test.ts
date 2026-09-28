import { AI_PERMISSION_KEYS, AI_ROLE_BUNDLES } from './permissions';

describe('Enterprise AI PBAC vocabulary', () => {
  it('keeps read-only analysts away from mutation permissions', () => {
    expect(AI_ROLE_BUNDLES.analyst).toEqual([
      'ai:workspace:view',
      'ai:billing:view',
      'ai:usage:view',
    ]);
    expect(AI_ROLE_BUNDLES.analyst).not.toContain('ai:api_keys:manage');
    expect(AI_ROLE_BUNDLES.analyst).not.toContain('ai:models:manage');
    expect(AI_ROLE_BUNDLES.analyst).not.toContain('ai:channels:manage');
  });

  it('does not let billing admins manage models, routes, knowledge, or channels', () => {
    expect(AI_ROLE_BUNDLES.billing_admin).not.toContain('ai:models:manage');
    expect(AI_ROLE_BUNDLES.billing_admin).not.toContain('ai:routes:manage');
    expect(AI_ROLE_BUNDLES.billing_admin).not.toContain('ai:knowledge:manage');
    expect(AI_ROLE_BUNDLES.billing_admin).not.toContain('ai:channels:manage');
  });

  it('keeps developer and channel responsibilities separate', () => {
    expect(AI_ROLE_BUNDLES.developer).toContain('ai:api_keys:manage');
    expect(AI_ROLE_BUNDLES.developer).not.toContain('ai:channels:manage');
    expect(AI_ROLE_BUNDLES.channel_manager).toContain('ai:channels:manage');
    expect(AI_ROLE_BUNDLES.channel_manager).not.toContain('ai:api_keys:manage');
  });

  it('gives Enterprise AI admins the complete AI permission vocabulary', () => {
    expect(new Set(AI_ROLE_BUNDLES.enterprise_admin)).toEqual(new Set(AI_PERMISSION_KEYS));
  });
});

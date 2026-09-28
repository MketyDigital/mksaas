import { AI_ROLE_BUNDLES } from './role-bundles';

describe('Enterprise AI role bundles', () => {
  it('keeps analysts read-only', () => {
    expect(AI_ROLE_BUNDLES.analyst).toEqual(['ai:workspace:view', 'ai:billing:view', 'ai:usage:view']);
    expect(AI_ROLE_BUNDLES.analyst).not.toContain('ai:api_keys:manage');
    expect(AI_ROLE_BUNDLES.analyst).not.toContain('ai:models:manage');
  });

  it('keeps billing admins away from model, key, knowledge and channel administration', () => {
    expect(AI_ROLE_BUNDLES.billing_admin).toContain('ai:billing:manage');
    expect(AI_ROLE_BUNDLES.billing_admin).not.toContain('ai:models:manage');
    expect(AI_ROLE_BUNDLES.billing_admin).not.toContain('ai:api_keys:manage');
    expect(AI_ROLE_BUNDLES.billing_admin).not.toContain('ai:knowledge:manage');
    expect(AI_ROLE_BUNDLES.billing_admin).not.toContain('ai:channels:manage');
  });

  it('keeps channel managers away from API-key and billing controls', () => {
    expect(AI_ROLE_BUNDLES.channel_manager).toContain('ai:channels:manage');
    expect(AI_ROLE_BUNDLES.channel_manager).not.toContain('ai:api_keys:manage');
    expect(AI_ROLE_BUNDLES.channel_manager).not.toContain('ai:billing:manage');
  });

  it('gives enterprise admins the complete AI permission vocabulary', () => {
    expect(AI_ROLE_BUNDLES.enterprise_admin).toHaveLength(11);
  });
});

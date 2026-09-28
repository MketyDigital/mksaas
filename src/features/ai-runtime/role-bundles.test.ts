import { AI_ROLE_BUNDLES } from './role-bundles';

describe('Enterprise AI role bundles', () => {
  it('keeps analysts read-only', () => {
    expect(AI_ROLE_BUNDLES.analyst).toEqual(['ai:read', 'ai:models:read', 'ai:usage:read']);
  });

  it('keeps billing admins away from model, key, knowledge and channel administration', () => {
    expect(AI_ROLE_BUNDLES.billing_admin).toContain('ai:billing:manage');
    expect(AI_ROLE_BUNDLES.billing_admin).not.toContain('ai:models:manage');
    expect(AI_ROLE_BUNDLES.billing_admin).not.toContain('ai:keys:manage');
    expect(AI_ROLE_BUNDLES.billing_admin).not.toContain('ai:knowledge:manage');
    expect(AI_ROLE_BUNDLES.billing_admin).not.toContain('ai:channels:manage');
  });

  it('keeps channel managers away from API-key and billing controls', () => {
    expect(AI_ROLE_BUNDLES.channel_manager).toContain('ai:channels:manage');
    expect(AI_ROLE_BUNDLES.channel_manager).not.toContain('ai:keys:manage');
    expect(AI_ROLE_BUNDLES.channel_manager).not.toContain('ai:billing:manage');
  });
});

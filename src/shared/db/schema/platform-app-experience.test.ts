import {
  platformAppControlCenterModules,
  platformAppDashboardSettings,
  platformAppExperienceEntityEnum,
  platformAppExperienceRevisions,
  platformAppExperienceStatusEnum,
  platformWorkspaceCards,
} from './platform-app-experience';

describe('platform app experience schema', () => {
  it('defines the required app experience lifecycle values', () => {
    expect(platformAppExperienceStatusEnum.enumValues).toEqual(['draft', 'published', 'archived']);
  });

  it('defines editable app experience entity types without exposing backend logic editing', () => {
    expect(platformAppExperienceEntityEnum.enumValues).toEqual([
      'dashboard_settings',
      'workspace_card',
      'control_center_module',
    ]);

    expect(platformAppExperienceEntityEnum.enumValues).not.toContain('backend_logic');
    expect(platformAppExperienceEntityEnum.enumValues).not.toContain('security_rule');
    expect(platformAppExperienceEntityEnum.enumValues).not.toContain('billing_ledger_logic');
    expect(platformAppExperienceEntityEnum.enumValues).not.toContain('deployment_engine');
  });

  it('defines platform-level tables for dashboard, workspace, control-center, and revisions', () => {
    expect(platformAppDashboardSettings).toBeDefined();
    expect(platformWorkspaceCards).toBeDefined();
    expect(platformAppControlCenterModules).toBeDefined();
    expect(platformAppExperienceRevisions).toBeDefined();
  });
});

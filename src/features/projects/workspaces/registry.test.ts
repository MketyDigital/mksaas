import { getProjectWorkspaceByKey, projectWorkspaces } from './registry';

describe('projectWorkspaces', () => {
  it('defines the required Mkety platform workspace keys in order', () => {
    expect(projectWorkspaces.map((workspace) => workspace.key)).toEqual(['ai', 'automation', 'deploy', 'solutions', 'trading']);
  });

  it('keeps Trading enterprise-gated and not self-service', () => {
    const trading = getProjectWorkspaceByKey('trading');

    expect(trading.availability).toBe('enterprise');
    expect(trading.description.toLowerCase()).toContain('enterprise');
    expect(trading.protectedReason?.toLowerCase()).toContain('custom');
  });

  it('routes AI through the ai segment', () => {
    expect(getProjectWorkspaceByKey('ai').hrefSegment).toBe('ai');
    expect(getProjectWorkspaceByKey('ai').availability).toBe('available');
  });
});

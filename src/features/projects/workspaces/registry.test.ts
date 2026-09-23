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

  it('marks implemented self-service workspace surfaces available', () => {
    expect(getProjectWorkspaceByKey('ai').availability).toBe('available');
    expect(getProjectWorkspaceByKey('automation').availability).toBe('available');
    expect(getProjectWorkspaceByKey('deploy').availability).toBe('available');
    expect(getProjectWorkspaceByKey('solutions').availability).toBe('available');

    expect(getProjectWorkspaceByKey('ai').hrefSegment).toBe('ai');
    expect(getProjectWorkspaceByKey('deploy').description).toContain('non-production');
    expect(getProjectWorkspaceByKey('deploy').description).toContain('production and domains remain protected');
    expect(getProjectWorkspaceByKey('solutions').statusLabel).toBe('Catalog available');
  });
});

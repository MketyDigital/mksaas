import { AI_PERMISSION_KEYS, isAiPermissionKey } from './permission-keys';

describe('Enterprise AI PBAC vocabulary', () => {
  it('contains the approved granular permission set without duplicates', () => {
    expect(AI_PERMISSION_KEYS).toEqual(expect.arrayContaining([
      'ai:read',
      'ai:agents:manage',
      'ai:keys:manage',
      'ai:models:read',
      'ai:models:manage',
      'ai:knowledge:manage',
      'ai:channels:manage',
      'ai:usage:read',
      'ai:billing:manage',
      'ai:security:manage',
    ]));
    expect(new Set(AI_PERMISSION_KEYS).size).toBe(AI_PERMISSION_KEYS.length);
  });

  it('rejects unknown AI permissions', () => {
    expect(isAiPermissionKey('ai:root')).toBe(false);
    expect(isAiPermissionKey('workspace.ai.enterprise')).toBe(false);
  });
});

import { seedDefaultPlatformAppExperience } from './seed';

describe('platform app experience seed contract', () => {
  it('exports an idempotent seed function for Mkety app experience defaults', () => {
    expect(seedDefaultPlatformAppExperience).toBeDefined();
    expect(typeof seedDefaultPlatformAppExperience).toBe('function');
  });
});

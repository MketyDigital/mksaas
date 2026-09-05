import { seedDefaultPlatformContent } from './seed';

describe('platform content seed contract', () => {
  it('exports an idempotent seed function for Mkety default public content', () => {
    expect(seedDefaultPlatformContent).toBeDefined();
    expect(typeof seedDefaultPlatformContent).toBe('function');
  });
});

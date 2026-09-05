import { PLATFORM_CONTENT_PERMISSION, PLATFORM_APP_EXPERIENCE_PERMISSION, PLATFORM_CONTROL_PERMISSION } from './authorization';

describe('platform content authorization constants', () => {
  it('keeps platform CMS and app experience permissions distinct', () => {
    expect(PLATFORM_CONTENT_PERMISSION).toBe('platform:content');
    expect(PLATFORM_APP_EXPERIENCE_PERMISSION).toBe('platform:app-experience');
    expect(PLATFORM_CONTROL_PERMISSION).toBe('admin:dashboard');
  });
});

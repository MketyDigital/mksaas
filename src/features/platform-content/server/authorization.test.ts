import { isPlatformControlTenant, PLATFORM_APP_EXPERIENCE_PERMISSION, PLATFORM_CONTENT_PERMISSION, PLATFORM_CONTROL_PERMISSION, PLATFORM_CONTROL_TENANT_ENV } from './authorization';

describe('platform content authorization constants', () => {
  it('keeps platform CMS and app experience permissions distinct', () => {
    expect(PLATFORM_CONTENT_PERMISSION).toBe('platform:content');
    expect(PLATFORM_APP_EXPERIENCE_PERMISSION).toBe('platform:app-experience');
    expect(PLATFORM_CONTROL_PERMISSION).toBe('admin:dashboard');
  });

  it('fails closed unless the tenant is the configured Mkety platform-control workspace', () => {
    const previous = process.env[PLATFORM_CONTROL_TENANT_ENV];
    delete process.env[PLATFORM_CONTROL_TENANT_ENV];
    expect(isPlatformControlTenant('mkety-ops')).toBe(false);

    process.env[PLATFORM_CONTROL_TENANT_ENV] = 'mkety-ops';
    expect(isPlatformControlTenant('mkety-ops')).toBe(true);
    expect(isPlatformControlTenant('customer-workspace')).toBe(false);

    if (previous === undefined) delete process.env[PLATFORM_CONTROL_TENANT_ENV];
    else process.env[PLATFORM_CONTROL_TENANT_ENV] = previous;
  });
});

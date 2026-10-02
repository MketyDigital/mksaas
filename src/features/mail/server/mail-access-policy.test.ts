import { getMailWorkspaceAccessMode } from './mail-access-policy';

describe('Mail workspace access mode', () => {
  it('requires platform operator checks for the exact reserved tenant', () => {
    expect(getMailWorkspaceAccessMode('reserved-tenant', 'reserved-tenant')).toBe('platform-operator');
    expect(getMailWorkspaceAccessMode('customer-tenant', 'reserved-tenant')).toBe('tenant-member');
  });

  it('fails closed when the reserved tenant setting is missing', () => {
    expect(getMailWorkspaceAccessMode('reserved-tenant', '')).toBe('tenant-member');
  });
});

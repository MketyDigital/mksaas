describe('platformEnterpriseOrders', () => {
  it('stores enterprise intake without tenant billing grants', async () => {
    const { platformEnterpriseOrders } = await import('./platform-enterprise-orders');

    expect(platformEnterpriseOrders).toBeDefined();

    const columns = Object.keys(platformEnterpriseOrders);
    expect(columns).not.toContain('tenantId');
    expect(columns).not.toContain('subscriptionId');
    expect(columns).not.toContain('entitlementId');
    expect(columns).not.toContain('walletId');
  });
});

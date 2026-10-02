import { createFirstPartySmtpCredentialRecord } from './first-party-smtp-credential';

describe('createFirstPartySmtpCredentialRecord', () => {
  const baseInput = {
    configuredTenantId: 'reserved-tenant',
    requestedTenantId: 'reserved-tenant',
    actorUserId: 'ops-user',
    workspace: { tenantId: 'reserved-tenant', status: 'active', hasMailEntitlement: true },
    mailbox: { id: 'mailbox-1', tenantId: 'reserved-tenant', address: 'info@mkety.com', status: 'active' },
    secret: 'mkmail-secret',
    passwordHash: '{SSHA256}hash',
  };

  it('creates an SMTP-only credential for the configured active platform mailbox', async () => {
    const insert = jest.fn().mockResolvedValue({ id: 'credential-1' });

    const result = await createFirstPartySmtpCredentialRecord(baseInput, { insert });

    expect(result).toEqual({ id: 'credential-1', secret: 'mkmail-secret' });
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'reserved-tenant',
      mailboxId: 'mailbox-1',
      userId: 'ops-user',
      protocolScope: 'smtp',
    }));
  });

  it.each([
    ['missing reserved tenant setting', { configuredTenantId: '' }],
    ['different target tenant', { requestedTenantId: 'customer-tenant' }],
    ['inactive workspace', { workspace: { ...baseInput.workspace, status: 'suspended' } }],
    ['missing Mail entitlement', { workspace: { ...baseInput.workspace, hasMailEntitlement: false } }],
    ['inactive mailbox', { mailbox: { ...baseInput.mailbox, status: 'disabled' } }],
    ['wrong mailbox address', { mailbox: { ...baseInput.mailbox, address: 'support@mkety.com' } }],
    ['mailbox belonging to another tenant', { mailbox: { ...baseInput.mailbox, tenantId: 'customer-tenant' } }],
  ])('fails closed for %s', async (_label, override) => {
    const insert = jest.fn();
    await expect(createFirstPartySmtpCredentialRecord({ ...baseInput, ...override }, { insert })).rejects.toThrow();
    expect(insert).not.toHaveBeenCalled();
  });
});

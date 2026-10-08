import { createFirstPartySmtpCredentialRecord } from './first-party-smtp-credential';

describe('createFirstPartySmtpCredentialRecord', () => {
  const baseInput = {
    configuredTenantId: 'reserved-tenant',
    requestedTenantId: 'reserved-tenant',
    actorUserId: 'ops-user',
    workspace: { tenantId: 'reserved-tenant', status: 'active', hasMailEntitlement: true },
    mailbox: { id: 'mailbox-1', tenantId: 'reserved-tenant', address: 'info@mail.mkety.com', status: 'active' },
    secret: 'mkmail-secret',
    passwordHash: '{SSHA256}hash',
  };

  it('creates an SMTP-only credential for the configured active platform mailbox', async () => {
    const replace = jest.fn().mockResolvedValue({ id: 'credential-1' });

    const result = await createFirstPartySmtpCredentialRecord(baseInput, { replace });

    expect(result).toEqual({ id: 'credential-1', secret: 'mkmail-secret' });
    expect(replace).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'reserved-tenant',
      mailboxId: 'mailbox-1',
      userId: 'ops-user',
      protocolScope: 'smtp',
    }));
    expect(replace).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['missing reserved tenant setting', { configuredTenantId: '' }],
    ['different target tenant', { requestedTenantId: 'customer-tenant' }],
    ['inactive workspace', { workspace: { ...baseInput.workspace, status: 'suspended' } }],
    ['missing Mail entitlement', { workspace: { ...baseInput.workspace, hasMailEntitlement: false } }],
    ['inactive mailbox', { mailbox: { ...baseInput.mailbox, status: 'disabled' } }],
    ['wrong mailbox address', { mailbox: { ...baseInput.mailbox, address: 'support@mail.mkety.com' } }],
    ['mailbox belonging to another tenant', { mailbox: { ...baseInput.mailbox, tenantId: 'customer-tenant' } }],
  ])('fails closed for %s', async (_label, override) => {
    const replace = jest.fn();
    await expect(createFirstPartySmtpCredentialRecord({ ...baseInput, ...override }, { replace })).rejects.toThrow();
    expect(replace).not.toHaveBeenCalled();
  });
});

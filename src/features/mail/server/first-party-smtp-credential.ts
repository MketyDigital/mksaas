type FirstPartyCredentialInput = {
  configuredTenantId: string;
  requestedTenantId: string;
  actorUserId: string;
  workspace: { tenantId: string; status: string; hasMailEntitlement: boolean } | null;
  mailbox: { id: string; tenantId: string; address: string; status: string } | null;
  secret: string;
  passwordHash: string;
};

export async function createFirstPartySmtpCredentialRecord(
  input: FirstPartyCredentialInput,
  dependencies: { replace: (record: {
    tenantId: string;
    mailboxId: string;
    userId: string;
    name: string;
    passwordPrefix: string;
    passwordHash: string;
    protocolScope: 'smtp';
  }) => Promise<{ id: string }> },
) {
  if (!input.configuredTenantId || input.requestedTenantId !== input.configuredTenantId) {
    throw new Error('The configured first-party Mail tenant is unavailable.');
  }
  if (
    !input.workspace ||
    input.workspace.tenantId !== input.configuredTenantId ||
    input.workspace.status !== 'active' ||
    !input.workspace.hasMailEntitlement
  ) {
    throw new Error('The first-party Mail workspace is not active and entitled.');
  }
  if (
    !input.mailbox ||
    input.mailbox.tenantId !== input.configuredTenantId ||
    input.mailbox.status !== 'active' ||
    input.mailbox.address.toLowerCase() !== 'info@mkety.com'
  ) {
    throw new Error('The active info@mkety.com mailbox is unavailable.');
  }
  const credential = await dependencies.replace({
    tenantId: input.configuredTenantId,
    mailboxId: input.mailbox.id,
    userId: input.actorUserId,
    name: 'Mkety platform SMTP',
    passwordPrefix: input.secret.slice(0, 12),
    passwordHash: input.passwordHash,
    protocolScope: 'smtp',
  });
  return { id: credential.id, secret: input.secret };
}

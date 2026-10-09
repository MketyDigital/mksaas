const ROOT_DOMAIN = 'mkety.com';
const FIRST_PARTY_INGRESS_DOMAIN = 'mail.mkety.com';

export function resolveFirstPartyIngressAlias(input: {
  configuredTenantId: string;
  targetTenantId: string;
  mailboxAddress: string;
  ingressDomain: string;
}) {
  const configuredTenantId = input.configuredTenantId.trim();
  const targetTenantId = input.targetTenantId.trim();
  const mailboxAddress = input.mailboxAddress.trim().toLowerCase();
  const ingressDomain = input.ingressDomain.trim().toLowerCase().replace(/\.$/, '');
  const match = /^([a-z0-9](?:[a-z0-9._+-]{0,126}[a-z0-9])?)@([^\s@]+)$/.exec(mailboxAddress);

  if (!configuredTenantId || targetTenantId !== configuredTenantId || !match) return null;
  if (match[2] !== ROOT_DOMAIN || match[1] === 'hello') return null;
  if (ingressDomain !== FIRST_PARTY_INGRESS_DOMAIN) return null;

  return {
    ingressAddress: `${match[1]}@${ingressDomain}`,
    mailboxAddress,
  };
}

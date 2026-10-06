import { env } from 'cloudflare:workers';

type MailRuntimeConfigKey =
  | 'MKETY_FIRST_PARTY_MAIL_TENANT_ID'
  | 'MKETY_MAIL_INTERNAL_SECRET'
  | 'MKETY_MAIL_GATEWAY_INTERNAL_SECRET'
  | 'MKETY_MAIL_EXTERNAL_CLIENTS_ENABLED';

function getMailRuntimeValue(key: MailRuntimeConfigKey): string {
  const binding = (env as unknown as Record<string, unknown>)[key];
  if (typeof binding === 'string') return binding;
  return process.env[key] ?? '';
}

export function getFirstPartyMailTenantId() {
  return getMailRuntimeValue('MKETY_FIRST_PARTY_MAIL_TENANT_ID');
}

export function getMailInternalSecret() {
  return getMailRuntimeValue('MKETY_MAIL_INTERNAL_SECRET');
}

export function getMailGatewayInternalSecret() {
  return getMailRuntimeValue('MKETY_MAIL_GATEWAY_INTERNAL_SECRET');
}

export function mailExternalClientsEnabled() {
  return getMailRuntimeValue('MKETY_MAIL_EXTERNAL_CLIENTS_ENABLED') === 'true';
}

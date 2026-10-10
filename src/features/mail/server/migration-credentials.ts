import { decryptConnectionSecret, encryptConnectionSecret } from '@/shared/security/connection-secrets';

export function normalizeImapEndpoint(host: string, port: number) {
  const normalized = host.trim().toLowerCase().replace(/\.$/, '');
  if (
    port !== 993 ||
    !normalized ||
    normalized.length > 253 ||
    normalized.includes('://') ||
    normalized.includes('/') ||
    normalized.includes('@')
  ) {
    throw new Error('imap_endpoint_invalid');
  }
  if (
    normalized === 'localhost' ||
    normalized.endsWith('.localhost') ||
    normalized.endsWith('.local') ||
    normalized.endsWith('.internal')
  ) {
    throw new Error('imap_endpoint_disallowed');
  }
  if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(normalized) || normalized.includes(':')) {
    throw new Error('imap_endpoint_disallowed');
  }
  if (!/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(normalized)) {
    throw new Error('imap_endpoint_invalid');
  }
  return normalized;
}

export async function encryptImapCredential(username: string, password: string) {
  if (
    !username.trim() ||
    username.length > 320 ||
    !password ||
    password.length > 2048 ||
    /[\r\n\0]/.test(username + password)
  ) {
    throw new Error('imap_credential_invalid');
  }
  return encryptConnectionSecret({ username: username.trim(), password });
}

export async function decryptImapCredential(value: string) {
  const secret = await decryptConnectionSecret(value);
  const username = secret.username;
  const password = secret.password;
  if (!username || !password) throw new Error('imap_credential_invalid');
  return { username, password };
}

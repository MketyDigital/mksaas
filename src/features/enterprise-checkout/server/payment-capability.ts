const CAPABILITY_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface EnterprisePaymentCapability {
  token: string;
  tokenHash: string;
  expiresAt: Date;
}

export async function hashEnterprisePaymentToken(token: string) {
  if (!/^[a-f0-9]{64}$/i.test(token)) throw new Error('Enterprise payment link is invalid.');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function createEnterprisePaymentCapability(now = new Date()): Promise<EnterprisePaymentCapability> {
  const random = crypto.getRandomValues(new Uint8Array(32));
  const token = [...random].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return {
    token,
    tokenHash: await hashEnterprisePaymentToken(token),
    expiresAt: new Date(now.getTime() + CAPABILITY_TTL_MS),
  };
}

export function isEnterprisePaymentCapabilityActive(input: {
  tokenHash: string | null;
  expiresAt: Date | null;
  now?: Date;
}) {
  return Boolean(input.tokenHash && /^[a-f0-9]{64}$/i.test(input.tokenHash) && input.expiresAt && input.expiresAt > (input.now ?? new Date()));
}

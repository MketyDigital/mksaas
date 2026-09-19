export const PUBLIC_AI_DEGRADED_COOKIE = 'mkety_public_ai_degraded';

export type DegradedPublicAIMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type DegradedPublicAIState = {
  conversationId: string;
  messages: DegradedPublicAIMessage[];
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_MESSAGES = 6;
const MAX_MESSAGE_CHARS = 600;

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(value: string): Uint8Array | null {
  try {
    const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    const binary = atob(padded);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

async function signingKey(secret: string): Promise<CryptoKey> {
  if (secret.length < 32) throw new Error('MKETY_PUBLIC_AI_VISITOR_SECRET must be at least 32 characters.');
  return crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
    'verify',
  ]);
}

function normalizeState(state: DegradedPublicAIState): DegradedPublicAIState {
  return {
    conversationId: state.conversationId,
    messages: state.messages
      .filter((message) => message.role === 'user' || message.role === 'assistant')
      .slice(-MAX_MESSAGES)
      .map((message) => ({ role: message.role, content: message.content.slice(0, MAX_MESSAGE_CHARS) })),
  };
}

export async function createDegradedConversationToken(
  state: DegradedPublicAIState,
  secret: string,
): Promise<string> {
  const normalized = normalizeState(state);
  if (!UUID_PATTERN.test(normalized.conversationId)) throw new Error('Degraded conversation id must be a UUID.');
  const payload = new TextEncoder().encode(JSON.stringify(normalized));
  const encodedPayload = toBase64Url(payload);
  const key = await signingKey(secret);
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(encodedPayload)));
  return `${encodedPayload}.${toBase64Url(signature)}`;
}

export async function parseDegradedConversationToken(
  token: string | undefined,
  secret: string,
): Promise<DegradedPublicAIState | null> {
  if (!token) return null;
  const separator = token.lastIndexOf('.');
  if (separator <= 0) return null;
  const encodedPayload = token.slice(0, separator);
  const signature = fromBase64Url(token.slice(separator + 1));
  const payload = fromBase64Url(encodedPayload);
  if (!signature || !payload) return null;

  const key = await signingKey(secret);
  const valid = await crypto.subtle.verify(
    'HMAC',
    key,
    new Uint8Array(signature).buffer,
    new TextEncoder().encode(encodedPayload),
  );
  if (!valid) return null;

  try {
    const parsed = JSON.parse(new TextDecoder().decode(payload)) as DegradedPublicAIState;
    if (!UUID_PATTERN.test(parsed.conversationId) || !Array.isArray(parsed.messages)) return null;
    return normalizeState(parsed);
  } catch {
    return null;
  }
}

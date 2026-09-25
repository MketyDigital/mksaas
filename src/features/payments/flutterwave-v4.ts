const TOKEN_URL = 'https://idp.flutterwave.com/realms/flutterwave/protocol/openid-connect/token';
const PRODUCTION_BASE_URL = 'https://api.flutterwave.com';

let cachedAccessToken: { value: string; expiresAt: number; clientId: string } | null = null;

function timingSafeEqualText(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

export async function getFlutterwaveV4AccessToken(input: {
  clientId: string;
  clientSecret: string;
  fetchImpl?: typeof fetch;
}): Promise<string> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const now = Date.now();
  if (
    cachedAccessToken &&
    cachedAccessToken.clientId === input.clientId &&
    cachedAccessToken.expiresAt - now > 60_000
  ) {
    return cachedAccessToken.value;
  }

  const response = await fetchImpl(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: input.clientId,
      client_secret: input.clientSecret,
      grant_type: 'client_credentials',
    }),
  });
  const payload = (await response.json().catch(() => null)) as { access_token?: string; expires_in?: number } | null;
  if (!response.ok || !payload?.access_token) throw new Error('Flutterwave v4 authentication failed.');
  const expiresIn = Math.max(60, Number(payload.expires_in ?? 600));
  cachedAccessToken = {
    value: payload.access_token,
    expiresAt: now + expiresIn * 1000,
    clientId: input.clientId,
  };
  return payload.access_token;
}

export async function verifyFlutterwaveV4Webhook(input: {
  rawBody: string;
  signature: string | null;
  secretHash: string;
}): Promise<Record<string, unknown>> {
  if (!input.signature) throw new Error('Flutterwave webhook signature is required.');
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(input.secretHash),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const digest = await crypto.subtle.sign('HMAC', key, encoder.encode(input.rawBody));
  const expected = btoa(String.fromCharCode(...new Uint8Array(digest)));
  if (!timingSafeEqualText(expected, input.signature)) throw new Error('Invalid Flutterwave webhook signature.');
  return JSON.parse(input.rawBody) as Record<string, unknown>;
}

export async function retrieveFlutterwaveV4Charge(input: {
  chargeId: string;
  clientId: string;
  clientSecret: string;
  fetchImpl?: typeof fetch;
  baseUrl?: string;
}): Promise<Record<string, unknown>> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const accessToken = await getFlutterwaveV4AccessToken({
    clientId: input.clientId,
    clientSecret: input.clientSecret,
    fetchImpl,
  });
  const response = await fetchImpl(`${input.baseUrl ?? PRODUCTION_BASE_URL}/charges/${encodeURIComponent(input.chargeId)}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Trace-Id': crypto.randomUUID(),
    },
  });
  const payload = (await response.json().catch(() => null)) as { status?: string; data?: Record<string, unknown> } | null;
  if (!response.ok || payload?.status !== 'success' || !payload.data) {
    throw new Error('Flutterwave charge verification failed.');
  }
  return payload.data;
}

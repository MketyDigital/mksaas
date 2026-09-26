const encoder = new TextEncoder();

function base64(bytes: ArrayBuffer): string {
  let binary = '';
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export async function createMketyPaymentAttestation(rawBody: string, secret: string): Promise<string> {
  if (!rawBody || !secret) throw new Error('Mkety payment attestation inputs are required.');
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return base64(await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody)));
}

export async function verifyMketyPaymentAttestation(
  rawBody: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  if (!rawBody || !signature || !secret) return false;
  const expected = await createMketyPaymentAttestation(rawBody, secret);
  const actual = signature.trim();
  if (expected.length !== actual.length) return false;

  let difference = 0;
  for (let index = 0; index < expected.length; index += 1) {
    difference |= expected.charCodeAt(index) ^ actual.charCodeAt(index);
  }
  return difference === 0;
}

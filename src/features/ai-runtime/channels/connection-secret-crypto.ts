import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const VERSION = 'aics1';
const IV_BYTES = 12;

function decodeKey(value?: string) {
  const configured = value ?? process.env.AI_CONNECTION_SECRET_ENCRYPTION_KEY ?? '';
  let key: Buffer;
  if (/^[0-9a-fA-F]{64}$/.test(configured)) key = Buffer.from(configured, 'hex');
  else {
    try { key = Buffer.from(configured, 'base64url'); }
    catch { key = Buffer.alloc(0); }
  }
  if (key.length !== 32) {
    throw new Error('AI_CONNECTION_SECRET_ENCRYPTION_KEY must decode to exactly 32 bytes.');
  }
  return key;
}

function decodeCanonical(value: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('invalid ciphertext');
  const decoded = Buffer.from(value, 'base64url');
  if (decoded.toString('base64url') !== value) throw new Error('invalid ciphertext');
  return decoded;
}

export function fingerprintAiConnectionSecret(secret: string) {
  return createHash('sha256').update(secret, 'utf8').digest('hex');
}

export function protectAiConnectionSecret(secret: string, encryptionKey?: string) {
  if (!secret) throw new Error('Connection secret is required.');
  const key = decodeKey(encryptionKey);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString('base64url'),
    tag.toString('base64url'),
    ciphertext.toString('base64url'),
  ].join('.');
}

export function revealAiConnectionSecret(value: string, encryptionKey?: string) {
  try {
    const [version, ivPart, tagPart, ciphertextPart, extra] = value.split('.');
    if (version !== VERSION || !ivPart || !tagPart || !ciphertextPart || extra) throw new Error('invalid ciphertext');
    const key = decodeKey(encryptionKey);
    const iv = decodeCanonical(ivPart);
    const tag = decodeCanonical(tagPart);
    const ciphertext = decodeCanonical(ciphertextPart);
    if (iv.length !== IV_BYTES || tag.length !== 16) throw new Error('invalid ciphertext');
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('AI_CONNECTION_SECRET_ENCRYPTION_KEY')) throw error;
    throw new Error('AI connection secret could not be decrypted.');
  }
}

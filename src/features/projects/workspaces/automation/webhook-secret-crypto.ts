import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const VERSION = 'v1';
const IV_BYTES = 12;

function decodeEncryptionKey(value?: string) {
  const configured = value ?? process.env.WEBHOOK_SECRET_ENCRYPTION_KEY ?? '';
  let key: Buffer;

  if (/^[0-9a-fA-F]{64}$/.test(configured)) key = Buffer.from(configured, 'hex');
  else {
    try { key = Buffer.from(configured, 'base64url'); }
    catch { key = Buffer.alloc(0); }
  }

  if (key.length !== 32) throw new Error('WEBHOOK_SECRET_ENCRYPTION_KEY must decode to exactly 32 bytes.');
  return key;
}

export function fingerprintWebhookSecret(secret: string) {
  return createHash('sha256').update(secret, 'utf8').digest('hex');
}

export function encryptWebhookSecret(secret: string, encryptionKey?: string) {
  const key = decodeEncryptionKey(encryptionKey);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString('base64url'), tag.toString('base64url'), ciphertext.toString('base64url')].join('.');
}

export function decryptWebhookSecret(value: string, encryptionKey?: string) {
  try {
    const [version, ivPart, tagPart, ciphertextPart, extra] = value.split('.');
    if (version !== VERSION || !ivPart || !tagPart || !ciphertextPart || extra) throw new Error('invalid ciphertext');
    const key = decodeEncryptionKey(encryptionKey);
    const iv = Buffer.from(ivPart, 'base64url');
    const tag = Buffer.from(tagPart, 'base64url');
    const ciphertext = Buffer.from(ciphertextPart, 'base64url');
    if (iv.length !== IV_BYTES || tag.length !== 16) throw new Error('invalid ciphertext');
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  } catch (error) {
    if (error instanceof Error && error.message === 'WEBHOOK_SECRET_ENCRYPTION_KEY must decode to exactly 32 bytes.') throw error;
    throw new Error('Webhook secret could not be decrypted.');
  }
}

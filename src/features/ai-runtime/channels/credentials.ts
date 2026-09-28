import {
  protectAiConnectionSecret,
  revealAiConnectionSecret,
} from './connection-secret-crypto';

export type EnterpriseAiChannelCredentials = {
  accessToken?: string;
  botToken?: string;
  signingSecret?: string;
  webhookSecret?: string;
  appSecret?: string;
  verificationToken?: string;
  apiKey?: string;
  clientSecret?: string;
  publicKey?: string;
};

function clean(value: FormDataEntryValue | null) {
  const text = String(value ?? '').trim();
  return text || undefined;
}

export function channelCredentialsFromForm(formData: FormData): EnterpriseAiChannelCredentials {
  const credentials = {
    accessToken: clean(formData.get('accessToken')),
    botToken: clean(formData.get('botToken')),
    signingSecret: clean(formData.get('signingSecret')),
    webhookSecret: clean(formData.get('webhookSecret')),
    appSecret: clean(formData.get('appSecret')),
    verificationToken: clean(formData.get('verificationToken')),
    apiKey: clean(formData.get('apiKey')),
    clientSecret: clean(formData.get('clientSecret')),
    publicKey: clean(formData.get('publicKey')),
  };
  return Object.fromEntries(Object.entries(credentials).filter(([, value]) => Boolean(value)));
}

export function protectChannelCredentials(credentials: EnterpriseAiChannelCredentials) {
  const values = Object.values(credentials).filter(Boolean);
  if (!values.length) return null;
  return protectAiConnectionSecret(JSON.stringify(credentials));
}

export function revealChannelCredentials(secretRef: string): EnterpriseAiChannelCredentials {
  const raw = revealAiConnectionSecret(secretRef);
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new Error('AI channel credential envelope is invalid.'); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('AI channel credential envelope is invalid.');
  }
  const allowed = new Set([
    'accessToken',
    'botToken',
    'signingSecret',
    'webhookSecret',
    'appSecret',
    'verificationToken',
    'apiKey',
    'clientSecret',
    'publicKey',
  ]);
  const result: EnterpriseAiChannelCredentials = {};
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (!allowed.has(key) || typeof value !== 'string' || !value) continue;
    (result as Record<string, string>)[key] = value;
  }
  return result;
}

import type { MketyPaymentSource } from './reference';

type ForwardableSource = Extract<MketyPaymentSource, 'media' | 'host'>;
type ForwardableProvider = 'flutterwave' | 'kora';

const DEFAULT_MEDIA_DESTINATIONS: Record<ForwardableProvider, string> = {
  flutterwave: 'https://media.mkety.com/api/billing/flutterwave/webhook',
  kora: 'https://media.mkety.com/api/billing/kora/webhook',
};

function destinationFor(source: ForwardableSource, provider: ForwardableProvider): string | null {
  const prefix = source === 'media' ? 'MKETY_MEDIA' : 'MKETY_HOST';
  const configured = process.env[`${prefix}_${provider.toUpperCase()}_WEBHOOK_URL`]?.trim();
  if (configured) {
    const url = new URL(configured);
    if (url.protocol !== 'https:') throw new Error('External Mkety payment webhook destination must use HTTPS.');
    return url.toString();
  }

  if (source === 'media') return DEFAULT_MEDIA_DESTINATIONS[provider];
  return null;
}

export async function forwardOriginalProviderWebhook(input: {
  source: ForwardableSource;
  provider: ForwardableProvider;
  rawBody: string;
  signature: string;
  contentType?: string | null;
  signatureHeader?: 'flutterwave-signature' | 'verif-hash' | 'x-korapay-signature';
}): Promise<{ forwarded: true; destination: string }> {
  const destination = destinationFor(input.source, input.provider);
  if (!destination) throw new Error(`${input.source} ${input.provider} webhook forwarding is not configured.`);

  const signatureHeader =
    input.signatureHeader ?? (input.provider === 'flutterwave' ? 'flutterwave-signature' : 'x-korapay-signature');
  const response = await fetch(destination, {
    method: 'POST',
    headers: {
      'Content-Type': input.contentType || 'application/json',
      [signatureHeader]: input.signature,
      'X-Mkety-Webhook-Forwarded': '1',
    },
    body: input.rawBody,
  });

  if (!response.ok) {
    throw new Error(`${input.source} ${input.provider} webhook forwarding failed.`);
  }

  return { forwarded: true, destination };
}

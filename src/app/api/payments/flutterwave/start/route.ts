import {
  createFlutterwaveHostedCheckout,
  isMketyFlutterwaveCollectionCurrency,
  quoteFlutterwaveCollection,
} from '@/features/payments/flutterwave-standard';
import { buildMketyPaymentMetadata, resolveMketyPaymentRoute } from '@/features/payments/reference';
import { createLogger } from '@/shared/lib/logger';

const logger = createLogger({ module: 'mkety-flutterwave-checkout-broker' });

interface BrokerRequest {
  source?: unknown;
  reference?: unknown;
  amount?: unknown;
  currency?: unknown;
  payment_currency?: unknown;
  canonical_amount_usd?: unknown;
  requested_payment_currency?: unknown;
  email?: unknown;
  customer_name?: unknown;
  invoice_id?: unknown;
  tenant_id?: unknown;
  checkout_id?: unknown;
  order_id?: unknown;
  redirect_url?: unknown;
}

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

function safeString(value: unknown, maxLength: number): string {
  return typeof value === 'string' && value.trim().length <= maxLength ? value.trim() : '';
}

function parseAmountMinor(value: unknown): bigint {
  const raw = typeof value === 'number' ? value.toFixed(2) : String(value ?? '').trim();
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(raw);
  if (!match) throw new Error('Invalid payment amount.');
  const amount = BigInt(match[1]) * 100n + BigInt((match[2] ?? '').padEnd(2, '0') || '0');
  if (amount <= 0n || amount > 100_000_000n) throw new Error('Invalid payment amount.');
  return amount;
}

function isAllowedRedirect(value: string, source: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return false;
    if (source === 'media') return url.hostname === 'media.mkety.com';
    if (source === 'host') return url.hostname.endsWith('.mkety.com') || url.hostname === 'mkety.com';
    return url.hostname === 'mkety.com' || url.hostname === 'app.mkety.com';
  } catch {
    return false;
  }
}

function bearerToken(request: Request): string {
  const authorization = request.headers.get('authorization') ?? '';
  return authorization.startsWith('Bearer ') ? authorization.slice('Bearer '.length).trim() : '';
}

function timingSafeEqualText(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

export async function POST(request: Request) {
  const brokerSecret = process.env.FLUTTERWAVE_CHECKOUT_BROKER_SECRET;
  const standardSecretKey = process.env.FLUTTERWAVE_STANDARD_SECRET_KEY;
  const standardWebhookHash = process.env.FLUTTERWAVE_STANDARD_WEBHOOK_HASH;
  if (!brokerSecret || !standardSecretKey || !standardWebhookHash) {
    return json({ success: false, message: 'Flutterwave hosted checkout broker is not configured.' }, 503);
  }

  const suppliedSecret = bearerToken(request);
  if (!suppliedSecret || !timingSafeEqualText(suppliedSecret, brokerSecret)) {
    return json({ success: false, message: 'Unauthorized.' }, 401);
  }

  try {
    const body = (await request.json()) as BrokerRequest;
    const source = safeString(body.source, 32);
    if (!['media', 'host', 'saas', 'enterprise'].includes(source)) {
      return json({ success: false, message: 'Unknown Mkety payment source.' }, 400);
    }

    const reference = safeString(body.reference, 42);
    const canonicalAmountMinor = parseAmountMinor(body.canonical_amount_usd ?? body.amount);
    const canonicalCurrency = body.canonical_amount_usd == null
      ? safeString(body.currency, 3).toUpperCase()
      : 'USD';
    const collectionCurrency =
      safeString(body.requested_payment_currency, 3).toUpperCase() ||
      safeString(body.payment_currency, 3).toUpperCase() ||
      canonicalCurrency;
    const email = safeString(body.email, 254).toLowerCase();
    const customerName = safeString(body.customer_name, 160);
    const redirectUrl = safeString(body.redirect_url, 500);

    if (!reference || !/^[a-zA-Z0-9-]{6,42}$/.test(reference)) {
      return json({ success: false, message: 'Invalid Mkety payment reference.' }, 400);
    }
    if (
      canonicalCurrency !== 'USD' ||
      !isMketyFlutterwaveCollectionCurrency(collectionCurrency) ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      !redirectUrl ||
      !isAllowedRedirect(redirectUrl, source)
    ) {
      return json({ success: false, message: 'Invalid checkout request.' }, 400);
    }

    const metadata = buildMketyPaymentMetadata({
      source: source as 'saas' | 'media' | 'host' | 'enterprise',
      invoiceId: safeString(body.invoice_id, 120) || undefined,
      tenantId: safeString(body.tenant_id, 120) || undefined,
      checkoutId: safeString(body.checkout_id, 120) || undefined,
      orderId: safeString(body.order_id, 160) || undefined,
    });
    const ownership = resolveMketyPaymentRoute(reference, { meta: metadata });
    if (!ownership || ownership.source !== source) {
      return json({ success: false, message: 'Mkety payment reference does not match the requested source.' }, 400);
    }

    const quote = await quoteFlutterwaveCollection({
      canonicalAmountMinor,
      canonicalCurrency: 'USD',
      collectionCurrency,
      secretKey: standardSecretKey,
    });
    const checkoutUrl = await createFlutterwaveHostedCheckout({
      source: source as 'saas' | 'media' | 'host' | 'enterprise',
      reference,
      amountMinor: quote.amountMinor,
      currency: quote.currency,
      email,
      customerName: customerName || undefined,
      redirectUrl,
      metadata: {
        ...metadata,
        canonical_amount_minor: canonicalAmountMinor.toString(),
        canonical_currency: 'USD',
        provider_amount_minor: quote.amountMinor.toString(),
        provider_currency: quote.currency,
        ...(quote.rate ? { fx_rate: quote.rate } : {}),
      },
      secretKey: standardSecretKey,
    });

    const checkoutAmount = Number(quote.amountMinor) / 100;
    return json({
      success: true,
      url: checkoutUrl,
      checkout_url: checkoutUrl,
      reference,
      amount: checkoutAmount,
      checkout_amount: checkoutAmount,
      currency: quote.currency,
      checkout_currency: quote.currency,
      canonical_amount_minor: canonicalAmountMinor.toString(),
      canonical_currency: 'USD',
      provider_amount_minor: quote.amountMinor.toString(),
      provider_currency: quote.currency,
      fx_rate: quote.rate ?? null,
      fx_source: quote.source,
    });
  } catch (error) {
    logger.error(
      { errorName: error instanceof Error ? error.name : 'UnknownError' },
      'Flutterwave checkout broker failed',
    );
    return json({ success: false, message: 'Flutterwave checkout could not be started.' }, 502);
  }
}

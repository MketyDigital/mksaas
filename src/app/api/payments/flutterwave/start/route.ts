import { createFlutterwaveStandardHostedCheckout } from '@/features/payments/flutterwave-standard';
import { buildMketyPaymentMetadata, resolveMketyPaymentRoute } from '@/features/payments/reference';
import { createLogger } from '@/shared/lib/logger';

const logger = createLogger({ module: 'mkety-flutterwave-checkout-broker' });

interface BrokerRequest {
  source?: unknown;
  reference?: unknown;
  amount?: unknown;
  currency?: unknown;
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

function parseAmount(value: unknown): number {
  const amount = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) {
    throw new Error('Invalid payment amount.');
  }
  return Math.round(amount * 100) / 100;
}

function amountToMinor(amount: number): bigint {
  return BigInt(Math.round(amount * 100));
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
  if (!brokerSecret) return json({ success: false, message: 'Flutterwave checkout broker is not configured.' }, 503);

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
    const amount = parseAmount(body.amount);
    const currency = safeString(body.currency, 3).toUpperCase();
    const email = safeString(body.email, 254).toLowerCase();
    const customerName = safeString(body.customer_name, 160);
    const redirectUrl = safeString(body.redirect_url, 500);
    if (!reference || !/^[a-zA-Z0-9-]{6,42}$/.test(reference)) {
      return json({ success: false, message: 'Invalid Mkety payment reference.' }, 400);
    }
    if (!/^[A-Z]{3}$/.test(currency) || !email || !redirectUrl || !isAllowedRedirect(redirectUrl, source)) {
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

    const mode = process.env.FLUTTERWAVE_API_MODE ?? 'v4';

    if (mode === 'v3-hosted') {
      const secretKey = process.env.FLUTTERWAVE_V3_SECRET_KEY;
      const secretHash = process.env.FLUTTERWAVE_V3_SECRET_HASH;
      if (!secretKey || !secretHash) {
        return json({ success: false, message: 'Flutterwave hosted checkout is not fully configured.' }, 503);
      }

      const { checkoutUrl } = await createFlutterwaveStandardHostedCheckout({
        secretKey,
        reference,
        amountMinor: amountToMinor(amount),
        currency,
        redirectUrl,
        customer: {
          email,
          ...(customerName ? { name: customerName } : {}),
        },
        metadata,
        title: source === 'media' ? 'Mkety Media' : 'Mkety',
        description: `Mkety payment ${reference}`,
      });
      return json({ success: true, checkout_url: checkoutUrl, url: checkoutUrl, reference });
    }

    // In v4 mode, OAuth/webhook verification is active but Flutterwave does not
    // expose the v3 method-agnostic hosted Standard checkout. Mkety therefore
    // fails closed rather than collecting raw card details or pretending that
    // a universal hosted v4 checkout exists.
    const v4Configured = Boolean(
      process.env.FLUTTERWAVE_CLIENT_ID &&
      process.env.FLUTTERWAVE_CLIENT_SECRET &&
      process.env.FLUTTERWAVE_WEBHOOK_SECRET,
    );
    if (!v4Configured) {
      return json({ success: false, message: 'Flutterwave v4 is not configured.' }, 503);
    }

    return json(
      {
        success: false,
        code: 'flutterwave_v4_payment_method_required',
        message:
          'Flutterwave v4 is configured for OAuth and shared webhook verification. A concrete v4 payment method flow must be selected before a charge can be created.',
        reference,
      },
      409,
    );
  } catch (error) {
    logger.error(
      { errorName: error instanceof Error ? error.name : 'UnknownError' },
      'Flutterwave checkout broker failed',
    );
    return json({ success: false, message: 'Flutterwave checkout could not be started.' }, 502);
  }
}

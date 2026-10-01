import { resolveMketyPaymentRoute } from '@/features/payments/reference';

interface StartBody {
  source?: unknown;
  reference?: unknown;
  canonical_amount_usd?: unknown;
  email?: unknown;
  customer_name?: unknown;
}

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

function bearer(request: Request) {
  const value = request.headers.get('authorization') || '';
  return value.startsWith('Bearer ') ? value.slice(7).trim() : '';
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i += 1) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

function amount(value: unknown) {
  const raw = typeof value === 'number' ? value.toFixed(2) : String(value ?? '').trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) throw new Error('invalid_amount');
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0 || n > 1_000_000) throw new Error('invalid_amount');
  return Number(n.toFixed(2));
}

export async function POST(request: Request) {
  const brokerSecret = process.env.FLUTTERWAVE_CHECKOUT_BROKER_SECRET;
  const apiKey = process.env.NOWPAYMENTS_API_KEY;
  if (!brokerSecret || !apiKey) return json({ success: false, message: 'NOWPayments broker is not configured.' }, 503);
  const supplied = bearer(request);
  if (!supplied || !safeEqual(supplied, brokerSecret)) return json({ success: false, message: 'Unauthorized.' }, 401);

  try {
    const body = (await request.json()) as StartBody;
    const source = String(body.source || '');
    const reference = String(body.reference || '').trim();
    const ownership = resolveMketyPaymentRoute(reference, { meta: { source } });
    if (source !== 'assist' || !ownership || ownership.source !== 'assist') {
      return json({ success: false, message: 'Invalid Assist payment reference.' }, 400);
    }
    const email = String(body.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ success: false, message: 'Invalid customer email.' }, 400);
    const priceAmount = amount(body.canonical_amount_usd);
    const response = await fetch('https://api.nowpayments.io/v1/invoice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify({
        price_amount: priceAmount,
        price_currency: 'usd',
        order_id: reference,
        order_description: `Mkety Assist - ${String(body.customer_name || 'customer').slice(0, 120)}`,
        ipn_callback_url: 'https://mkety.com/api/webhooks/payments/nowpayments',
        success_url: 'https://mkety-assist.mkety.app/payment/return?reference=' + encodeURIComponent(reference),
        cancel_url: 'https://mkety-assist.mkety.app/payment/return?reference=' + encodeURIComponent(reference),
      }),
    });
    const data = (await response.json()) as { id?: string | number; invoice_url?: string; message?: string };
    if (!response.ok || data.id == null || !data.invoice_url?.startsWith('https://')) {
      return json({ success: false, message: 'NOWPayments invoice creation failed.' }, 502);
    }
    return json({
      success: true,
      provider: 'nowpayments',
      reference,
      provider_checkout_id: String(data.id),
      checkout_url: data.invoice_url,
      amount: priceAmount,
      currency: 'USD',
    });
  } catch {
    return json({ success: false, message: 'NOWPayments checkout could not be started.' }, 502);
  }
}

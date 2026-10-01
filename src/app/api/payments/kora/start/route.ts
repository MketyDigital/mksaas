import { createHmac } from 'node:crypto';
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
  const publicKey = process.env.KORA_PUBLIC_KEY;
  const secretKey = process.env.KORA_SECRET_KEY;
  if (!brokerSecret || !publicKey || !secretKey) return json({ success: false, message: 'Kora is not configured.' }, 503);
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
    const canonicalAmount = amount(body.canonical_amount_usd);
    const payload = Buffer.from(JSON.stringify({
      reference,
      amount: canonicalAmount,
      currency: 'USD',
      email,
      customerName: String(body.customer_name || 'Mkety Assist customer').slice(0, 160),
      exp: Math.floor(Date.now() / 1000) + 900,
    })).toString('base64url');
    const signature = createHmac('sha256', brokerSecret).update(payload).digest('base64url');
    const checkoutUrl = `https://mkety.com/payments/kora/assist?payload=${encodeURIComponent(payload)}&signature=${encodeURIComponent(signature)}`;
    return json({ success: true, provider: 'kora', reference, checkout_url: checkoutUrl, amount: canonicalAmount, currency: 'USD' });
  } catch {
    return json({ success: false, message: 'Kora checkout could not be started.' }, 502);
  }
}

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
export async function GET(request: Request) {
  const secret = process.env.FLUTTERWAVE_CHECKOUT_BROKER_SECRET;
  if (!secret) return json({ success: false }, 503);
  const supplied = bearer(request);
  if (!supplied || !safeEqual(supplied, secret)) return json({ success: false }, 401);
  return json({
    success: true,
    methods: {
      nowpayments: Boolean(process.env.NOWPAYMENTS_API_KEY && process.env.NOWPAYMENTS_IPN_SECRET),
      flutterwave: Boolean(
        process.env.FLUTTERWAVE_STANDARD_SECRET_KEY &&
        process.env.FLUTTERWAVE_STANDARD_WEBHOOK_HASH &&
        process.env.FLUTTERWAVE_CHECKOUT_BROKER_SECRET
      ),
      kora: Boolean(process.env.KORA_PUBLIC_KEY && process.env.KORA_SECRET_KEY),
    },
  });
}

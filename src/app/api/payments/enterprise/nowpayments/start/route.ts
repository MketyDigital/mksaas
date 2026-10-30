import { NextResponse } from 'next/server';

import { enterpriseCheckoutService } from '@/features/enterprise-checkout/server/service';
import { fetchNowPaymentsCurrencies } from '@/features/payments/nowpayments-currencies';

const headers = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' };

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { token?: unknown; payCurrency?: unknown } | null;
  if (typeof body?.token !== 'string' || typeof body.payCurrency !== 'string') {
    return NextResponse.json({ error: 'Payment link or currency is invalid.' }, { status: 400, headers });
  }
  try {
    const apiKey = process.env.NOWPAYMENTS_API_KEY?.trim();
    if (!apiKey) return NextResponse.json({ error: 'Payment checkout is temporarily unavailable.' }, { status: 503, headers });
    const currencies = await fetchNowPaymentsCurrencies({ apiKey });
    const payCurrency = body.payCurrency.trim().toUpperCase();
    if (!currencies.includes(payCurrency)) {
      return NextResponse.json({ error: 'That payment currency is no longer available. Refresh and choose another.' }, { status: 400, headers });
    }
    const result = await enterpriseCheckoutService.startNowPaymentsInvoice({ token: body.token, payCurrency });
    return NextResponse.json(result, { headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Payment checkout is temporarily unavailable.';
    const status = /invalid or expired/.test(message) ? 404 : /already being prepared|operator review/.test(message) ? 409 : 503;
    return NextResponse.json({ error: message }, { status, headers });
  }
}

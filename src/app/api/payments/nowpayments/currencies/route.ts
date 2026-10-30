import { NextResponse } from 'next/server';

import { defaultNowPaymentsCurrency, fetchNowPaymentsCurrencies } from '@/features/payments/nowpayments-currencies';

const NO_STORE = { 'Cache-Control': 'no-store' };

export async function GET() {
  const apiKey = process.env.NOWPAYMENTS_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ currencies: [], defaultCurrency: null, source: 'unavailable' }, { status: 503, headers: NO_STORE });
  }
  try {
    const currencies = await fetchNowPaymentsCurrencies({ apiKey });
    return NextResponse.json({
      currencies,
      defaultCurrency: defaultNowPaymentsCurrency(currencies),
      source: 'nowpayments',
    }, { headers: NO_STORE });
  } catch {
    return NextResponse.json({ currencies: [], defaultCurrency: null, source: 'unavailable' }, { status: 503, headers: NO_STORE });
  }
}

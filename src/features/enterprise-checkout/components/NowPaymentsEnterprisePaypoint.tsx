'use client';

import { useEffect, useState } from 'react';

interface CurrencyResponse { currencies: string[]; defaultCurrency: string | null }

export function NowPaymentsEnterprisePaypoint({ token }: { token: string }) {
  const [currencies, setCurrencies] = useState<string[]>([]);
  const [currency, setCurrency] = useState('');
  const [message, setMessage] = useState('Loading available payment methods…');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch('/api/payments/nowpayments/currencies', { cache: 'no-store' })
      .then(async (response) => response.ok ? await response.json() as CurrencyResponse : null)
      .then((result) => {
        if (!result?.currencies?.length) { setMessage('Crypto checkout is temporarily unavailable. Contact Mkety support.'); return; }
        setCurrencies(result.currencies);
        setCurrency(result.defaultCurrency ?? result.currencies[0] ?? '');
        setMessage('Choose the currency you want to pay with.');
      })
      .catch(() => setMessage('Crypto checkout is temporarily unavailable. Contact Mkety support.'));
  }, []);

  async function beginCheckout() {
    setBusy(true);
    setMessage('Preparing secure checkout…');
    try {
      const response = await fetch('/api/payments/enterprise/nowpayments/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ token, payCurrency: currency }),
      });
      const result = await response.json() as { redirectUrl?: string; error?: string };
      if (!response.ok || !result.redirectUrl || !result.redirectUrl.startsWith('https://mkety.com/')) {
        setMessage(result.error ?? 'Checkout could not be confirmed. Contact Mkety support before retrying.');
        return;
      }
      window.location.assign(result.redirectUrl);
    } catch {
      setMessage('Checkout could not be confirmed. Contact Mkety support before retrying.');
    } finally {
      setBusy(false);
    }
  }

  if (!token || !/^[a-f0-9]{64}$/i.test(token)) {
    return <p role="alert" className="text-sm text-destructive">This payment link is invalid.</p>;
  }

  return <section className="mx-auto w-full max-w-lg space-y-5 rounded-2xl border bg-card p-6 shadow-sm">
    <div>
      <h1 className="text-2xl font-semibold">Complete your payment</h1>
      <p className="mt-2 text-sm text-muted-foreground">Choose an available cryptocurrency. The agreed USD amount remains fixed.</p>
    </div>
    {currencies.length ? <label className="block text-sm font-medium">Payment currency
      <select value={currency} onChange={(event) => setCurrency(event.target.value)} className="mt-2 w-full rounded-xl border bg-background px-4 py-3">
        {currencies.map((ticker) => <option key={ticker} value={ticker}>{ticker}</option>)}
      </select>
    </label> : null}
    <button type="button" onClick={beginCheckout} disabled={!currencies.length || !currency || busy}
      className="w-full rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground disabled:opacity-60">
      {busy ? 'Preparing checkout…' : 'Continue to payment'}
    </button>
    <p role="status" aria-live="polite" className="text-sm text-muted-foreground">{message}</p>
  </section>;
}

'use client';

import { useMemo, useState, useTransition } from 'react';

import { updateFlutterwavePaymentSettings } from '@/features/payments/server/admin-actions';

type Settings = {
  baseCurrency: 'USD';
  enabledCurrencies: string[];
  fxRates: Record<string, string | undefined>;
  fxMarkupBps: number;
};

const CURRENCY_NAMES: Record<string, string> = {
  USD: 'US Dollar',
  NGN: 'Nigerian Naira',
  GHS: 'Ghanaian Cedi',
  KES: 'Kenyan Shilling',
  GBP: 'British Pound',
  EUR: 'Euro',
  ZAR: 'South African Rand',
  XAF: 'Central African CFA Franc',
  XOF: 'West African CFA Franc',
  UGX: 'Ugandan Shilling',
  RWF: 'Rwandan Franc',
  TZS: 'Tanzanian Shilling',
  EGP: 'Egyptian Pound',
  MWK: 'Malawian Kwacha',
};

export function FlutterwavePaymentSettingsForm({
  tenant,
  settings,
}: {
  tenant: string;
  settings: Settings;
}) {
  const [enabled, setEnabled] = useState(() => new Set(settings.enabledCurrencies));
  const [rates, setRates] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(settings.fxRates).map(([key, value]) => [key, value ?? ''])),
  );
  const [markupPercent, setMarkupPercent] = useState((settings.fxMarkupBps / 100).toFixed(2).replace(/\.00$/, ''));
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const currencies = useMemo(() => Object.keys(CURRENCY_NAMES), []);

  function toggleCurrency(currency: string) {
    if (currency === 'USD') return;
    setEnabled((current) => {
      const next = new Set(current);
      if (next.has(currency)) next.delete(currency);
      else next.add(currency);
      return next;
    });
  }

  function save() {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      try {
        await updateFlutterwavePaymentSettings(tenant, {
          enabledCurrencies: [...enabled],
          fxRates: rates,
          markupPercent,
        });
        setMessage('Flutterwave payment settings saved.');
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Unable to save payment settings.');
      }
    });
  }

  return (
    <section className="rounded-2xl border bg-card p-6 shadow-sm">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Flutterwave</p>
        <h2 className="mt-2 text-xl font-semibold">Currency & FX configuration</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Mkety prices remain in USD. Enable customer collection currencies and set the local units charged for 1 USD.
          These are commercial settings, not secrets, so changes apply without a deployment.
        </p>
      </div>

      <label className="mt-6 block max-w-xs text-sm font-medium">
        FX markup / buffer (%)
        <input
          value={markupPercent}
          onChange={(event) => setMarkupPercent(event.target.value)}
          inputMode="decimal"
          className="mt-2 w-full rounded-xl border bg-background px-4 py-3 outline-none focus:border-primary"
          placeholder="0"
        />
        <span className="mt-1 block text-xs font-normal text-muted-foreground">
          Applied to each configured non-USD rate. Example: 2 means a 2% buffer.
        </span>
      </label>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="pb-3 pr-4">Enabled</th>
              <th className="pb-3 pr-4">Currency</th>
              <th className="pb-3 pr-4">Name</th>
              <th className="pb-3">1 USD =</th>
            </tr>
          </thead>
          <tbody>
            {currencies.map((currency) => (
              <tr key={currency} className="border-b last:border-0">
                <td className="py-3 pr-4">
                  <input
                    type="checkbox"
                    checked={currency === 'USD' || enabled.has(currency)}
                    disabled={currency === 'USD'}
                    onChange={() => toggleCurrency(currency)}
                    aria-label={`Enable ${currency}`}
                  />
                </td>
                <td className="py-3 pr-4 font-semibold">{currency}</td>
                <td className="py-3 pr-4 text-muted-foreground">{CURRENCY_NAMES[currency]}</td>
                <td className="py-3">
                  {currency === 'USD' ? (
                    <span className="font-mono">1</span>
                  ) : (
                    <input
                      value={rates[currency] ?? ''}
                      onChange={(event) => setRates((current) => ({ ...current, [currency]: event.target.value }))}
                      inputMode="decimal"
                      className="w-44 rounded-lg border bg-background px-3 py-2 outline-none focus:border-primary"
                      placeholder="Enter rate"
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-5 rounded-xl bg-muted/50 p-4 text-xs leading-5 text-muted-foreground">
        A non-USD currency can be enabled before its rate is entered, but checkout fails closed for that currency until
        a valid rate exists. Flutterwave decides which payment rails appear for each currency based on your merchant account.
      </div>

      {message ? <p className="mt-4 text-sm text-emerald-600">{message}</p> : null}
      {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}

      <button
        type="button"
        onClick={save}
        disabled={isPending}
        className="mt-5 rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground disabled:opacity-60"
      >
        {isPending ? 'Saving…' : 'Save Flutterwave settings'}
      </button>
    </section>
  );
}

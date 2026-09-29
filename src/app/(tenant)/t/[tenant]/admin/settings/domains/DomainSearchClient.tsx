'use client';

import { useState, useTransition } from 'react';

type Quote = {
  domain: string;
  available: boolean;
  currency: string;
  registrationPriceMinor: string | null;
  renewalPriceMinor: string | null;
};

function formatMoney(minor: string | null, currency: string) {
  if (minor === null) return 'Not available';
  const amount = Number(minor) / 100;
  if (!Number.isFinite(amount)) return 'Not available';
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return currency + ' ' + amount.toFixed(2);
  }
}

export function DomainSearchClient({ tenantSlug }: { tenantSlug: string }) {
  const [domain, setDomain] = useState('');
  const [years, setYears] = useState(1);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const search = () => {
    const value = domain.trim().toLowerCase();
    if (!value) return;
    startTransition(async () => {
      setMessage(null);
      setQuote(null);
      const query = new URLSearchParams({ domain: value, years: String(years) });
      const response = await fetch(
        `/api/tenants/${tenantSlug}/managed-domains/quote?${query.toString()}`,
        { cache: 'no-store' },
      );
      const result = await response.json();
      if (!result.success) {
        setMessage(result.error || 'Mkety could not check this domain.');
        return;
      }
      setQuote(result.data);
    });
  };

  return (
    <div className="space-y-4">
      <form
        className="grid gap-3 md:grid-cols-[1fr_140px_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          search();
        }}
      >
        <label className="text-sm font-medium">
          Domain
          <input
            className="mt-2 h-10 w-full rounded-lg border bg-background px-3 text-sm"
            disabled={isPending}
            onChange={(event) => setDomain(event.target.value)}
            placeholder="yourbrand.com"
            value={domain}
          />
        </label>
        <label className="text-sm font-medium">
          Years
          <select
            className="mt-2 h-10 w-full rounded-lg border bg-background px-3 text-sm"
            disabled={isPending}
            onChange={(event) => setYears(Number(event.target.value))}
            value={years}
          >
            {[1, 2, 3, 4, 5].map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
        </label>
        <button
          className="h-10 self-end rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          disabled={isPending || !domain.trim()}
          type="submit"
        >
          {isPending ? 'Checking…' : 'Search'}
        </button>
      </form>

      {message ? (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {message}
        </div>
      ) : null}

      {quote ? (
        <div className="rounded-xl border bg-muted/15 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-semibold">{quote.domain}</p>
              <p className={`mt-1 text-sm ${quote.available ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                {quote.available ? 'Available to register through Mkety' : 'Not available'}
              </p>
            </div>
            {quote.available ? (
              <div className="text-right">
                <p className="text-lg font-bold">{formatMoney(quote.registrationPriceMinor, quote.currency)}</p>
                <p className="text-xs text-muted-foreground">
                  Renewal {formatMoney(quote.renewalPriceMinor, quote.currency)}
                </p>
              </div>
            ) : null}
          </div>
          {quote.available ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Price shown is the current Mkety sell price for this search. Registration completes only after the corresponding Mkety payment is verified.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

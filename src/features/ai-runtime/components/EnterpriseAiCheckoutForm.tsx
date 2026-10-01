'use client';

import { useState } from 'react';

type Provider = {
  value: 'nowpayments' | 'flutterwave' | 'kora';
  label: string;
};

interface Props {
  tenantSlug: string;
  providers: Provider[];
  buttonLabel: string;
  amount?: {
    defaultValue: string;
    min: string;
    max?: string;
    label?: string;
    helpText?: string;
  };
  compact?: boolean;
}

export function EnterpriseAiCheckoutForm({
  tenantSlug,
  providers,
  buttonLabel,
  amount,
  compact = false,
}: Props) {
  const [provider, setProvider] = useState<Provider['value']>(providers[0]?.value ?? 'nowpayments');
  const [fundingAmountUsd, setFundingAmountUsd] = useState(amount?.defaultValue ?? '');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!providers.length || submitting) return;

    setSubmitting(true);
    setMessage('');

    try {
      const response = await fetch(
        `/api/tenants/${encodeURIComponent(tenantSlug)}/enterprise-ai/checkout`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider,
            ...(amount ? { fundingAmountUsd } : {}),
          }),
        },
      );
      const payload = await response.json().catch(() => null) as
        | { success?: boolean; checkoutUrl?: string; message?: string }
        | null;

      if (!response.ok || !payload?.success || !payload.checkoutUrl) {
        setMessage(payload?.message ?? 'Payment checkout could not be created. Please try again.');
        return;
      }

      window.location.assign(payload.checkoutUrl);
    } catch {
      setMessage('Payment checkout could not be started. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!providers.length) {
    return (
      <p className="rounded-xl border bg-amber-500/5 p-3 text-sm">
        No payment method is currently available. Please contact Mkety support.
      </p>
    );
  }

  return (
    <form
      className={compact ? 'grid min-w-[260px] gap-2' : 'grid gap-3 sm:grid-cols-2'}
      onSubmit={submit}
    >
      {amount ? (
        <label className={compact ? 'text-sm font-medium' : 'text-sm font-medium sm:col-span-2'}>
          {amount.label ?? 'Funding amount (USD)'}
          <input
            className="mt-1 w-full rounded-xl border bg-background px-3 py-3"
            inputMode="decimal"
            min={amount.min}
            max={amount.max}
            required
            step="0.01"
            value={fundingAmountUsd}
            onChange={(event) => setFundingAmountUsd(event.target.value)}
          />
          {amount.helpText ? (
            <span className="mt-1 block text-xs text-muted-foreground">{amount.helpText}</span>
          ) : null}
        </label>
      ) : null}

      <select
        className="rounded-xl border bg-background px-3 py-3 text-sm"
        value={provider}
        onChange={(event) => setProvider(event.target.value as Provider['value'])}
      >
        {providers.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>

      <button
        className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        disabled={submitting}
        type="submit"
      >
        {submitting ? 'Opening secure checkout…' : buttonLabel}
      </button>

      {message ? (
        <p className={compact ? 'text-sm text-destructive' : 'text-sm text-destructive sm:col-span-2'}>
          {message}
        </p>
      ) : null}
    </form>
  );
}

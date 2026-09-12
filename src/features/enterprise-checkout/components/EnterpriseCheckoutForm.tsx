'use client';

import { useState } from 'react';

const scopes = [
  ['ai', 'Custom AI Solution'],
  ['automation', 'Automation & Integrations'],
  ['application', 'Custom Application'],
  ['infrastructure', 'Infrastructure & Deployment'],
  ['other', 'Other Enterprise Project'],
] as const;

export function EnterpriseCheckoutForm() {
  const [provider, setProvider] = useState<'nowpayments' | 'selar'>('nowpayments');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const scopeId = String(form.get('scopeId') ?? 'other');
    const scope = scopes.find(([id]) => id === scopeId);
    const body = {
      fullName: form.get('fullName'),
      companyName: form.get('companyName'),
      email: form.get('email'),
      phone: form.get('phone'),
      country: form.get('country'),
      scopeId,
      projectName: form.get('projectName') || scope?.[1] || 'Enterprise Project',
      projectDescription: form.get('projectDescription'),
      amount: form.get('amount'),
      currency: 'USD',
      provider,
    };

    try {
      const response = await fetch('/api/payments/enterprise/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': crypto.randomUUID(),
        },
        body: JSON.stringify(body),
      });
      const data = (await response.json()) as { success?: boolean; redirectUrl?: string; message?: string };
      if (!response.ok || !data.redirectUrl) throw new Error(data.message || 'Unable to start checkout.');
      window.location.assign(data.redirectUrl);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to start checkout.');
      setSubmitting(false);
    }
  }

  const fieldClass =
    'w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none transition focus:border-primary';

  return (
    <form onSubmit={submit} className="space-y-6 rounded-3xl border border-border bg-card p-6 shadow-sm md:p-8">
      <div>
        <h2 className="text-2xl font-semibold">Enterprise project checkout</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Use the project price already agreed with Mkety. Payment verification happens securely after checkout.
        </p>
      </div>

      {error ? (
        <div
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm font-medium">
          Full name
          <input className={`${fieldClass} mt-2`} name="fullName" required maxLength={120} />
        </label>
        <label className="text-sm font-medium">
          Company / organization
          <input className={`${fieldClass} mt-2`} name="companyName" required maxLength={160} />
        </label>
        <label className="text-sm font-medium">
          Business email
          <input className={`${fieldClass} mt-2`} name="email" type="email" required maxLength={254} />
        </label>
        <label className="text-sm font-medium">
          Phone (optional)
          <input className={`${fieldClass} mt-2`} name="phone" maxLength={50} />
        </label>
        <label className="text-sm font-medium">
          Country / region
          <input className={`${fieldClass} mt-2`} name="country" maxLength={120} />
        </label>
        <label className="text-sm font-medium">
          Project category
          <select className={`${fieldClass} mt-2`} name="scopeId" defaultValue="ai">
            {scopes.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block text-sm font-medium">
        Project name
        <input
          className={`${fieldClass} mt-2`}
          name="projectName"
          required
          maxLength={180}
          placeholder="Your agreed enterprise project"
        />
      </label>
      <label className="block text-sm font-medium">
        Project requirements
        <textarea className={`${fieldClass} mt-2 min-h-28`} name="projectDescription" maxLength={5000} />
      </label>
      <label className="block text-sm font-medium">
        Agreed project price (USD)
        <div className="mt-2 flex items-center rounded-xl border border-border bg-background">
          <span className="pl-4 text-muted-foreground">$</span>
          <input
            className="w-full bg-transparent px-2 py-3 outline-none"
            name="amount"
            inputMode="decimal"
            required
            placeholder="199.00"
          />
        </div>
      </label>

      <fieldset>
        <legend className="text-sm font-medium">Payment method</legend>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <button
            type="button"
            onClick={() => setProvider('nowpayments')}
            className={`rounded-2xl border p-4 text-left ${provider === 'nowpayments' ? 'border-primary bg-primary/5' : 'border-border'}`}
          >
            <span className="block font-semibold">Crypto</span>
            <span className="mt-1 block text-sm text-muted-foreground">Secure hosted checkout via NOWPayments.</span>
          </button>
          <button
            type="button"
            onClick={() => setProvider('selar')}
            className={`rounded-2xl border p-4 text-left ${provider === 'selar' ? 'border-primary bg-primary/5' : 'border-border'}`}
          >
            <span className="block font-semibold">Card / local payment</span>
            <span className="mt-1 block text-sm text-muted-foreground">
              Hosted checkout via Selar. Confirmation may require verification.
            </span>
          </button>
        </div>
      </fieldset>

      <div className="rounded-xl bg-muted/50 p-4 text-xs leading-5 text-muted-foreground">
        Completing a checkout does not automatically activate a subscription, wallet, credits, infrastructure, or
        project provisioning. Mkety verifies payment before fulfillment begins.
      </div>

      <button
        disabled={submitting}
        className="w-full rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground disabled:opacity-60"
      >
        {submitting ? 'Starting secure checkout…' : 'Continue to secure payment'}
      </button>
    </form>
  );
}

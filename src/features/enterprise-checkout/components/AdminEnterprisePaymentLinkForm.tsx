'use client';

import { useState, useTransition } from 'react';

import { createEnterprisePaymentLink } from '@/features/enterprise-checkout/server/admin-actions';

interface AdminEnterprisePaymentLinkFormProps {
  tenant: string;
}

export function AdminEnterprisePaymentLinkForm({ tenant }: AdminEnterprisePaymentLinkFormProps) {
  const [provider, setProvider] = useState<'nowpayments' | 'selar'>('nowpayments');
  const [result, setResult] = useState<{ orderId: string; redirectUrl: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const fieldClass = 'w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none transition focus:border-primary';

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(null);
    setResult(null);

    startTransition(async () => {
      try {
        const created = await createEnterprisePaymentLink(tenant, {
          fullName: String(form.get('fullName') ?? ''),
          companyName: String(form.get('companyName') ?? ''),
          email: String(form.get('email') ?? ''),
          phone: String(form.get('phone') ?? ''),
          country: String(form.get('country') ?? ''),
          scopeId: String(form.get('scopeId') ?? 'enterprise'),
          projectName: String(form.get('projectName') ?? ''),
          projectDescription: String(form.get('projectDescription') ?? ''),
          amount: String(form.get('amount') ?? ''),
          provider,
          installmentLabel: String(form.get('installmentLabel') ?? ''),
        });
        setResult({ orderId: created.orderId, redirectUrl: created.redirectUrl });
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Unable to create Enterprise payment link.');
      }
    });
  }

  async function copyLink() {
    if (!result?.redirectUrl) return;
    await navigator.clipboard.writeText(result.redirectUrl);
  }

  return (
    <form onSubmit={submit} className="space-y-6 rounded-2xl border bg-card p-6 shadow-sm">
      <div>
        <h2 className="text-xl font-semibold">Issue negotiated payment link</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Enter only the amount agreed with the customer. For deposits or milestones, issue one link per installment amount.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm font-medium">Customer name<input className={`${fieldClass} mt-2`} name="fullName" required maxLength={120} /></label>
        <label className="text-sm font-medium">Company / organization<input className={`${fieldClass} mt-2`} name="companyName" required maxLength={160} /></label>
        <label className="text-sm font-medium">Email<input className={`${fieldClass} mt-2`} name="email" type="email" required maxLength={254} /></label>
        <label className="text-sm font-medium">Phone<input className={`${fieldClass} mt-2`} name="phone" maxLength={50} /></label>
        <label className="text-sm font-medium">Country / region<input className={`${fieldClass} mt-2`} name="country" maxLength={120} /></label>
        <label className="text-sm font-medium">Enterprise scope<select className={`${fieldClass} mt-2`} name="scopeId" defaultValue="trading"><option value="trading">Trading Workspace / Infrastructure</option><option value="ai">Custom AI Solution</option><option value="automation">Automation & Integrations</option><option value="application">Custom Application</option><option value="infrastructure">Infrastructure & Deployment</option><option value="enterprise">Other Enterprise Project</option></select></label>
      </div>

      <label className="block text-sm font-medium">Project / agreement name<input className={`${fieldClass} mt-2`} name="projectName" required maxLength={180} /></label>
      <label className="block text-sm font-medium">Payment stage<input className={`${fieldClass} mt-2`} name="installmentLabel" maxLength={160} placeholder="e.g. 50% deposit, milestone 2, final balance" /></label>
      <label className="block text-sm font-medium">Internal/customer-facing scope note<textarea className={`${fieldClass} mt-2 min-h-28`} name="projectDescription" maxLength={5000} /></label>
      <label className="block text-sm font-medium">Exact amount to collect (USD)<div className="mt-2 flex items-center rounded-xl border border-border bg-background"><span className="pl-4 text-muted-foreground">$</span><input className="w-full bg-transparent px-2 py-3 outline-none" name="amount" inputMode="decimal" required placeholder="2500.00" /></div></label>

      <fieldset>
        <legend className="text-sm font-medium">Gateway</legend>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <button type="button" onClick={() => setProvider('nowpayments')} className={`rounded-xl border p-4 text-left ${provider === 'nowpayments' ? 'border-primary bg-primary/5' : 'border-border'}`}><span className="font-semibold">NOWPayments</span><span className="mt-1 block text-sm text-muted-foreground">Crypto hosted invoice.</span></button>
          <button type="button" onClick={() => setProvider('selar')} className={`rounded-xl border p-4 text-left ${provider === 'selar' ? 'border-primary bg-primary/5' : 'border-border'}`}><span className="font-semibold">Selar</span><span className="mt-1 block text-sm text-muted-foreground">Card/local hosted checkout.</span></button>
        </div>
      </fieldset>

      {error ? <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div> : null}

      {result ? (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
          <p className="text-sm font-semibold">Payment link created</p>
          <p className="mt-1 text-xs text-muted-foreground">Order: {result.orderId}</p>
          <div className="mt-3 break-all rounded-lg bg-background p-3 text-xs">{result.redirectUrl}</div>
          <button type="button" onClick={copyLink} className="mt-3 rounded-lg border px-3 py-2 text-sm font-medium">Copy payment link</button>
        </div>
      ) : null}

      <div className="rounded-xl bg-muted/50 p-4 text-xs leading-5 text-muted-foreground">
        Creating or paying this link does not automatically grant a subscription, wallet balance, credits, infrastructure, or workspace entitlement. Payment must be verified and fulfillment/access remains a separate controlled step.
      </div>

      <button disabled={isPending} className="w-full rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground disabled:opacity-60">{isPending ? 'Creating payment link…' : 'Create payment link'}</button>
    </form>
  );
}

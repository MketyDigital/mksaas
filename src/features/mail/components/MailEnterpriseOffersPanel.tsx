'use client';

import { type FormEvent, useState, useTransition } from 'react';

import { createMailEnterpriseOfferPaymentLink } from '@/features/mail/server/admin-actions';

interface Props {
  tenantSlug: string;
  customers: Array<{ id: string; name: string; slug: string }>;
  offers: Array<{
    id: string;
    tenantName: string;
    tenantSlug: string;
    name: string;
    amountMinor: bigint;
    currency: string;
    termDays: number | null;
    status: string;
    orderId: string | null;
    createdAt: Date;
    paymentUrl: string | null;
  }>;
}

const numericFields = [
  ['domains', 'Domains'],
  ['mailboxes', 'Mailboxes'],
  ['teamSeats', 'Team seats'],
  ['sharedInboxes', 'Shared inboxes'],
  ['storageGb', 'Storage (GB)'],
  ['outboundMessagesPerMonth', 'Outbound messages / month'],
  ['customerUpdateDeliveriesPerMonth', 'Customer update deliveries / month'],
  ['maxRecipientsPerCustomerUpdate', 'Max recipients per update'],
] as const;

export function MailEnterpriseOffersPanel({ tenantSlug, customers, offers }: Props) {
  const [result, setResult] = useState<{ url: string; orderId: string; offerId: string; notificationQueued: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = event.currentTarget;
    const formData = new FormData(form);
    startTransition(async () => {
      try {
        const created = await createMailEnterpriseOfferPaymentLink(tenantSlug, formData);
        setResult({ url: created.redirectUrl, orderId: created.orderId, offerId: created.offerId, notificationQueued: created.notificationQueued });
      } catch {
        setError('Offer checkout could not be created. Review the entered terms and payment provider readiness, then retry.');
      }
    });
  }

  return (
    <div className="space-y-5">
      {result ? (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-4 text-sm">
          <p className="font-semibold">Payment link created</p>
          <p className="mt-1 text-muted-foreground">Offer {result.offerId} · order {result.orderId} · payment email {result.notificationQueued ? 'queued through Mkety Mail' : 'not queued; copy the link below after checking Mail readiness'}</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <a className="rounded-lg bg-primary px-3 py-2 font-semibold text-primary-foreground" href={result.url} rel="noreferrer" target="_blank">Open customer checkout</a>
            <button className="rounded-lg border px-3 py-2 font-semibold" onClick={() => void navigator.clipboard.writeText(result.url)} type="button">Copy payment link</button>
          </div>
        </div>
      ) : null}
      {error ? <p className="rounded-lg border border-destructive/40 p-3 text-sm text-destructive" role="alert">{error}</p> : null}

      <form className="grid gap-4 rounded-xl border p-4 lg:grid-cols-3" onSubmit={submit}>
        <label className="text-sm font-medium lg:col-span-3">
          Customer workspace
          <select className="mt-1 w-full rounded-lg border bg-background px-3 py-2" name="targetTenantId" required defaultValue="">
            <option value="" disabled>Select a workspace</option>
            {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name} · {customer.slug}</option>)}
          </select>
          <span className="mt-1 block text-xs font-normal text-muted-foreground">This links the settled offer to an existing workspace. Starpips can be selected here once its workspace exists.</span>
        </label>
        <label className="text-sm font-medium">Offer name<input className="mt-1 w-full rounded-lg border bg-background px-3 py-2" maxLength={180} name="offerName" required /></label>
        <label className="text-sm font-medium">One-time price (USD)<input className="mt-1 w-full rounded-lg border bg-background px-3 py-2" inputMode="decimal" name="amountUsd" pattern="\d{1,7}(?:\.\d{1,2})?" required /></label>
        <label className="text-sm font-medium">Access term<select className="mt-1 w-full rounded-lg border bg-background px-3 py-2" defaultValue="" name="termDays" required><option value="" disabled>Select agreed term</option><option value="365">365 days from payment</option><option value="180">180 days from payment</option><option value="90">90 days from payment</option><option value="unlimited">No expiry</option></select></label>
        <label className="text-sm font-medium">Billing contact name<input className="mt-1 w-full rounded-lg border bg-background px-3 py-2" maxLength={120} name="customerName" required /></label>
        <label className="text-sm font-medium">Billing contact email<input className="mt-1 w-full rounded-lg border bg-background px-3 py-2" maxLength={254} name="customerEmail" type="email" required /></label>
        <label className="text-sm font-medium">Company name<input className="mt-1 w-full rounded-lg border bg-background px-3 py-2" maxLength={160} name="companyName" /></label>
        <label className="text-sm font-medium">Payment provider<select className="mt-1 w-full rounded-lg border bg-background px-3 py-2" defaultValue="flutterwave" name="provider"><option value="flutterwave">Flutterwave</option><option value="kora">Kora</option></select></label>
        <label className="text-sm font-medium lg:col-span-2">Offer details<textarea className="mt-1 w-full rounded-lg border bg-background px-3 py-2" maxLength={2000} name="description" rows={2} /></label>
        <div className="grid gap-3 sm:grid-cols-2 lg:col-span-3">
          {numericFields.map(([name, label]) => (
            <label className="text-sm font-medium" key={name}>{label}<input className="mt-1 w-full rounded-lg border bg-background px-3 py-2" inputMode="numeric" min={1} name={name} required type="number" /></label>
          ))}
        </div>
        <p className="text-xs text-muted-foreground lg:col-span-3">Access and these limits activate only after verified full payment. USD and one-time payment are currently supported; do not issue the offer until customer terms and limits are agreed.</p>
        <button className="w-fit rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60 lg:col-span-3" disabled={pending} type="submit">{pending ? 'Creating checkout…' : 'Create Mail Enterprise payment link'}</button>
      </form>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Recent Mail Enterprise offers</h3>
        {offers.length ? offers.map((offer) => (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-sm" key={offer.id}>
            <div><p className="font-medium">{offer.name} · {offer.tenantName}</p><p className="text-xs text-muted-foreground">{offer.tenantSlug} · {offer.currency} {(Number(offer.amountMinor) / 100).toFixed(2)} · {offer.termDays === null ? 'no expiry' : `${offer.termDays} days`} · {offer.status}</p></div>
            {offer.paymentUrl && offer.status === 'awaiting_payment' ? <a className="font-semibold text-primary" href={offer.paymentUrl} rel="noreferrer" target="_blank">Open payment link</a> : null}
          </div>
        )) : <p className="text-sm text-muted-foreground">No custom Mail offers yet.</p>}
      </div>
    </div>
  );
}

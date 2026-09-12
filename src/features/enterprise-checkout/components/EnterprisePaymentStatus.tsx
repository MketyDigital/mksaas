'use client';

import { useEffect, useState } from 'react';

type PublicOrderStatus = {
  id: string;
  provider: string;
  checkoutStatus: string;
  paymentStatus: string;
  amountMinor: string;
  currency: string;
  projectName: string;
  confirmedAt: string | null;
};

export function EnterprisePaymentStatus({
  orderId,
  returnState,
}: {
  orderId?: string;
  returnState: 'pending' | 'success' | 'cancelled';
}) {
  const [order, setOrder] = useState<PublicOrderStatus | null>(null);
  const [loading, setLoading] = useState(Boolean(orderId));

  useEffect(() => {
    if (!orderId) return;
    let active = true;
    fetch(`/api/payments/enterprise/status?orderId=${encodeURIComponent(orderId)}`, { cache: 'no-store' })
      .then((response) => response.json())
      .then((data) => {
        if (active && data?.order) setOrder(data.order);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [orderId]);

  const confirmed = order?.paymentStatus === 'confirmed';
  const failed = order?.paymentStatus === 'failed' || returnState === 'cancelled';

  return (
    <div className="mx-auto max-w-2xl rounded-3xl border border-border bg-card p-8 text-center shadow-sm">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">Mkety Enterprise</p>
      <h1 className="mt-3 text-3xl font-semibold">
        {confirmed ? 'Payment verified' : failed ? 'Checkout not completed' : 'Payment verification pending'}
      </h1>
      <p className="mt-4 leading-7 text-muted-foreground">
        {confirmed
          ? 'Mkety has verified this enterprise payment. The project is ready for fulfillment follow-up.'
          : failed
            ? 'This checkout was cancelled or could not be verified. No enterprise access or provisioning has been activated.'
            : 'Your browser has returned from the payment provider, but that return is not proof of payment. Mkety will only mark this order paid after provider verification.'}
      </p>
      {loading ? <p className="mt-6 text-sm text-muted-foreground">Checking order status…</p> : null}
      {order ? (
        <dl className="mt-8 grid gap-3 rounded-2xl bg-muted/50 p-5 text-left text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Order</dt>
            <dd className="font-medium">{order.id}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Project</dt>
            <dd className="font-medium">{order.projectName}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Provider</dt>
            <dd className="font-medium">{order.provider}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Payment status</dt>
            <dd className="font-medium">{order.paymentStatus}</dd>
          </div>
        </dl>
      ) : null}
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <a href="/enterprise" className="rounded-xl border border-border px-5 py-3 text-sm font-semibold">
          Back to Enterprise
        </a>
        {!confirmed && !failed ? (
          <a href="/contact" className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground">
            Contact Mkety
          </a>
        ) : null}
      </div>
    </div>
  );
}

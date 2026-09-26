'use client';

import Script from 'next/script';
import { useState } from 'react';

interface KoraPayload {
  publicKey: string;
  reference: string;
  amount: number;
  currency: string;
  email: string;
  customerName: string;
  notificationUrl: string;
  redirectPath: string;
  metadata: Record<string, unknown>;
}

declare global {
  interface Window {
    Korapay?: {
      initialize: (options: Record<string, unknown>) => void;
    };
  }
}

export function KoraEmbeddedLauncher({ payload }: { payload: KoraPayload }) {
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState('Kora checkout will load securely inside this Mkety page.');

  function launch() {
    if (!ready || !window.Korapay) {
      setMessage('Secure checkout is still loading. Please try again.');
      return;
    }

    setMessage('Secure Kora checkout loaded below.');
    window.Korapay.initialize({
      key: payload.publicKey,
      reference: payload.reference,
      amount: payload.amount,
      currency: payload.currency,
      customer: {
        name: payload.customerName,
        email: payload.email,
      },
      notification_url: payload.notificationUrl,
      narration: 'Secure Mkety payment',
      metadata: payload.metadata,
      merchant_bears_cost: true,
      containerId: 'mkety-kora-checkout',
      onSuccess: () => {
        window.location.assign(payload.redirectPath);
      },
      onPending: () => {
        setMessage('Payment is pending confirmation. Mkety will verify it before activating access.');
      },
      onFailed: () => {
        setMessage('The payment was not completed. You can try again.');
      },
      onClose: () => {
        setMessage('Checkout closed. No access is activated until Mkety verifies payment.');
      },
    });
  }

  return (
    <>
      <Script
        src="https://korablobstorage.blob.core.windows.net/modal-bucket/korapay-collections.min.js"
        strategy="afterInteractive"
        onLoad={() => setReady(true)}
      />
      <div className="mx-auto max-w-2xl rounded-3xl border bg-card p-6 shadow-sm md:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-primary">Secure payment</p>
        <h1 className="mt-2 text-2xl font-bold">Pay with Kora</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{message}</p>
        <div className="mt-6 rounded-2xl bg-muted/40 p-4">
          <p className="text-sm text-muted-foreground">Amount</p>
          <p className="mt-1 text-2xl font-semibold">
            {payload.currency} {payload.amount.toFixed(2)}
          </p>
        </div>
        <button
          type="button"
          onClick={launch}
          disabled={!ready}
          className="mt-6 w-full rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground disabled:opacity-60"
        >
          {ready ? 'Open Kora checkout' : 'Loading secure checkout…'}
        </button>
        <div id="mkety-kora-checkout" className="mx-auto mt-6 min-h-[500px] max-w-[420px] overflow-hidden rounded-2xl" />
        <p className="mt-4 text-xs leading-5 text-muted-foreground">
          The Kora interface is provider-controlled. Mkety grants value only after webhook verification and a server-side
          charge re-query.
        </p>
      </div>
    </>
  );
}

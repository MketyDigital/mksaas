'use client';

import Script from 'next/script';
import { useState } from 'react';

interface FlutterwaveInlinePayload {
  publicKey: string;
  reference: string;
  amount: string;
  currency: string;
  email: string;
  customerName?: string;
  redirectPath: string;
  metadata: Record<string, unknown>;
  payloadHash: string;
}

declare global {
  interface Window {
    FlutterwaveCheckout?: (options: Record<string, unknown>) => { close?: () => void };
  }
}

export function FlutterwaveInlineLauncher({ payload }: { payload: FlutterwaveInlinePayload }) {
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState('Flutterwave will open securely over this Mkety page.');

  function launch() {
    if (!ready || !window.FlutterwaveCheckout) {
      setMessage('Secure checkout is still loading. Please try again.');
      return;
    }

    setMessage('Opening secure Flutterwave checkout…');
    window.FlutterwaveCheckout({
      public_key: payload.publicKey,
      tx_ref: payload.reference,
      amount: Number(payload.amount),
      currency: payload.currency,
      redirect_url: `${window.location.origin}${payload.redirectPath}`,
      payload_hash: payload.payloadHash,
      customer: {
        email: payload.email,
        ...(payload.customerName ? { name: payload.customerName } : {}),
      },
      meta: payload.metadata,
      customizations: {
        title: 'Mkety',
        description: 'Secure Mkety payment',
      },
      onclose: () => setMessage('Checkout closed. No access is activated until Mkety verifies payment.'),
    });
  }

  return (
    <>
      <Script
        src="https://checkout.flutterwave.com/v3.js"
        strategy="afterInteractive"
        onLoad={() => setReady(true)}
      />
      <div className="mx-auto max-w-xl rounded-3xl border bg-card p-6 shadow-sm md:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-primary">Secure payment</p>
        <h1 className="mt-2 text-2xl font-bold">Pay with Flutterwave</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{message}</p>
        <div className="mt-6 rounded-2xl bg-muted/40 p-4">
          <p className="text-sm text-muted-foreground">Amount</p>
          <p className="mt-1 text-2xl font-semibold">
            {payload.currency} {payload.amount}
          </p>
        </div>
        <button
          type="button"
          onClick={launch}
          disabled={!ready}
          className="mt-6 w-full rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground disabled:opacity-60"
        >
          {ready ? 'Continue with Flutterwave' : 'Loading secure checkout…'}
        </button>
        <p className="mt-4 text-xs leading-5 text-muted-foreground">
          Payment completion in the modal does not by itself activate access. Mkety waits for a verified provider
          webhook and server-side transaction verification.
        </p>
      </div>
    </>
  );
}

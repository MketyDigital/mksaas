'use client';

import Script from 'next/script';
import { useCallback, useEffect, useRef, useState } from 'react';

type InlineConfig = {
  public_key: string;
  tx_ref: string;
  amount: number;
  currency: string;
  redirect_url: string;
  customer: { email: string; name?: string };
  customizations: { title: string; description: string; logo: string };
  meta: Record<string, unknown>;
  payload_hash: string;
};

declare global {
  interface Window {
    FlutterwaveCheckout?: (config: Record<string, unknown>) => { close?: () => void };
  }
}

export function FlutterwaveInlineLauncher({ config }: { config: InlineConfig }) {
  const [loaded, setLoaded] = useState(false);
  const [opened, setOpened] = useState(false);
  const launched = useRef(false);

  const launch = useCallback(() => {
    if (!window.FlutterwaveCheckout || launched.current) return;
    launched.current = true;
    setOpened(true);
    window.FlutterwaveCheckout({
      ...config,
      onclose: () => {
        launched.current = false;
        setOpened(false);
      },
    });
  }, [config]);

  useEffect(() => {
    if (loaded) launch();
  }, [loaded, launch]);

  return (
    <>
      <Script
        src="https://checkout.flutterwave.com/v3.js"
        strategy="afterInteractive"
        onLoad={() => setLoaded(true)}
      />
      <button
        type="button"
        disabled={!loaded || opened}
        onClick={launch}
        className="w-full rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground disabled:opacity-60"
      >
        {!loaded ? 'Preparing secure payment…' : opened ? 'Flutterwave checkout is open' : 'Open secure payment'}
      </button>
    </>
  );
}

'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { Button } from '@/shared/components/ui';

export function MketyPublicAuthActions() {
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadSession() {
      try {
        const response = await fetch('/api/auth/session', {
          credentials: 'include',
          cache: 'no-store',
          headers: { Accept: 'application/json' },
        });
        if (!response) return;
        const session = response.ok ? await response.json() : null;
        if (active) setAuthenticated(Boolean(session?.user));
      } catch {
        if (active) setAuthenticated(false);
      }
    }

    void loadSession();

    return () => {
      active = false;
    };
  }, []);

  if (authenticated) {
    return (
      <>
        <Button asChild variant="ghost" className="px-3">
          <Link href="/settings">Account</Link>
        </Button>
        <Button asChild className="rounded-xl">
          <Link href="/app">Dashboard</Link>
        </Button>
      </>
    );
  }

  return (
    <>
      <Button asChild variant="ghost" className="px-3">
        <Link href="/login">Sign In</Link>
      </Button>
      <Button asChild className="hidden rounded-xl sm:inline-flex">
        <Link href="/signup">Get Started</Link>
      </Button>
    </>
  );
}

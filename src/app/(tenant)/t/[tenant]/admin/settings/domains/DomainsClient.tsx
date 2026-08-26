'use client';

import { useState, useTransition } from 'react';

import type { CustomDomain } from '@/shared/db/schema';

interface Props {
  tenantSlug: string;
  initialDomains: CustomDomain[];
}

export function DomainsClient({ tenantSlug, initialDomains }: Props) {
  const [domains, setDomains] = useState(initialDomains);
  const [hostname, setHostname] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const call = (method: string, body: { hostname: string }) => {
    startTransition(async () => {
      setMessage(null);
      const response = await fetch(`/api/tenants/${tenantSlug}/domains`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!result.success) {
        setMessage(result.error || 'Request failed');
        return;
      }
      if (method === 'POST') {
        setDomains((current) => [...current, result.data]);
        setHostname('');
      } else if (method === 'PUT') {
        setDomains((current) => current.map((domain) => (domain.hostname === body.hostname ? result.data : domain)));
      } else if (method === 'DELETE') {
        setDomains((current) => current.filter((domain) => domain.hostname !== body.hostname));
      }
      setMessage(result.message || 'Done');
    });
  };

  return (
    <div className="space-y-6">
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          if (hostname.trim()) call('POST', { hostname });
        }}
      >
        <input
          value={hostname}
          onChange={(event) => setHostname(event.target.value)}
          placeholder="app.example.com"
          className="h-10 flex-1 rounded-md border bg-background px-3 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-primary"
          disabled={isPending}
        />
        <button type="submit" disabled={isPending || !hostname.trim()} className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50">
          {isPending ? 'Working…' : 'Add domain'}
        </button>
      </form>

      {message && <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">{message}</div>}

      <div className="space-y-3">
        {domains.length === 0 ? (
          <p className="text-sm text-muted-foreground">No custom domains have been added.</p>
        ) : (
          domains.map((domain) => (
            <div key={domain.id} className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium">{domain.hostname}</p>
                <p className="text-xs text-muted-foreground capitalize">
                  {domain.status} · {domain.provider}
                </p>
              </div>
              <div className="flex gap-2">
                {domain.status !== 'verified' && (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => call('PUT', { hostname: domain.hostname })}
                    className="rounded-md border px-3 py-2 text-xs font-medium hover:bg-muted disabled:opacity-50"
                  >
                    Verify
                  </button>
                )}
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => call('DELETE', { hostname: domain.hostname })}
                  className="rounded-md border px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
                >
                  Remove
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Development mode</p>
        <p className="mt-1">
          If VERCEL_AUTH_BEARER_TOKEN and VERCEL_PROJECT_ID are blank, domains are stored safely in the database but no external Vercel API call is made.
        </p>
      </div>
    </div>
  );
}

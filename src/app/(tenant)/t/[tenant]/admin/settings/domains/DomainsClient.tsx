'use client';

import { useState, useTransition } from 'react';

import type { CustomDomain } from '@/shared/db/schema';

interface Props {
  tenantSlug: string;
  initialDomains: CustomDomain[];
}

function domainSetup(value: string | null) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as {
      cnameTarget?: string;
      ownershipVerification?: { type?: string; name?: string; value?: string } | null;
    };
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
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
          domains.map((domain) => {
            const setup = domainSetup(domain.verification);
            return (
              <div key={domain.id} className="rounded-lg border p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{domain.hostname}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {domain.status} · Mkety managed
                    </p>
                    {domain.status !== 'verified' && setup?.cnameTarget ? (
                      <div className="mt-3 rounded-md bg-muted/40 p-3 text-xs">
                        <p className="font-medium text-foreground">DNS target</p>
                        <p className="mt-1 break-all font-mono text-muted-foreground">{setup.cnameTarget}</p>
                        {setup.ownershipVerification?.name && setup.ownershipVerification?.value ? (
                          <>
                            <p className="mt-3 font-medium text-foreground">
                              {setup.ownershipVerification.type?.toUpperCase() || 'Verification'} record
                            </p>
                            <p className="mt-1 break-all font-mono text-muted-foreground">
                              {setup.ownershipVerification.name} → {setup.ownershipVerification.value}
                            </p>
                          </>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 gap-2">
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
              </div>
            );
          })
        )}
      </div>

      <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">How connection works</p>
        <p className="mt-1">
          Mkety creates and verifies the managed hostname, then keeps HTTPS and routing status connected to this workspace. Infrastructure providers remain behind Mkety.
        </p>
      </div>
    </div>
  );
}

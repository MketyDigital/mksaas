'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';

import type { ManagedDomain } from '@/shared/db/schema';

export function ManagedDomainsClient({
  tenantSlug,
  initialDomains,
}: {
  tenantSlug: string;
  initialDomains: ManagedDomain[];
}) {
  const [domains, setDomains] = useState(initialDomains);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const update = (
    body: { id: string; action: 'provision-dns' } | { id: string; autoRenew: boolean },
    method: 'POST' | 'PATCH',
  ) => {
    startTransition(async () => {
      setMessage(null);
      const response = await fetch(`/api/tenants/${tenantSlug}/managed-domains`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!result.success) {
        setMessage(result.error || 'Request failed');
        return;
      }
      if (result.data?.id) {
        setDomains((current) => current.map((domain) => domain.id === result.data.id ? result.data : domain));
      }
      setMessage(result.message || 'Saved');
    });
  };

  if (domains.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
        No domains have been registered through Mkety yet. Purchased domains will appear here automatically after verified settlement.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {message ? <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">{message}</div> : null}
      <p className="text-xs text-muted-foreground">
        Auto-renew preference keeps the domain queued for renewal, but Mkety renews only after the renewal payment is verified.
      </p>
      {domains.map((domain) => (
        <div key={domain.id} className="rounded-xl border p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate font-semibold">{domain.domain}</p>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium capitalize text-muted-foreground">
                  {domain.status}
                </span>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                  DNS {domain.dnsStatus}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {domain.expiresAt ? `Expires ${new Date(domain.expiresAt).toLocaleDateString()}` : 'Expiry pending provider confirmation'}
                {' · '}
                {Array.isArray(domain.nameServers) && domain.nameServers.length
                  ? `${domain.nameServers.length} authoritative nameservers`
                  : 'Nameservers not provisioned yet'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium">
                <input
                  type="checkbox"
                  checked={domain.autoRenew}
                  disabled={isPending}
                  onChange={(event) => update({ id: domain.id, autoRenew: event.target.checked }, 'PATCH')}
                />
                Auto-renew preference
              </label>
              {domain.dnsZoneId ? (
                <Link
                  href={`/app/${tenantSlug}/admin/settings/domains/${domain.id}`}
                  className="rounded-lg border px-3 py-2 text-xs font-semibold hover:bg-muted"
                >
                  Manage DNS
                </Link>
              ) : (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => update({ id: domain.id, action: 'provision-dns' }, 'POST')}
                  className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                >
                  Set up Mkety DNS
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

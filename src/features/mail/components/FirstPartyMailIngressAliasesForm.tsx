'use client';

import { useActionState } from 'react';

import { configureFirstPartyMailIngressAliases } from '@/features/mail/server/admin-actions';

type State = { configuredAddresses?: string[]; error?: string };

export function FirstPartyMailIngressAliasesForm({ tenant }: { tenant: string }) {
  const [state, action, pending] = useActionState(
    configureFirstPartyMailIngressAliases.bind(null, tenant),
    {} as State,
  );

  return (
    <form action={action} className="space-y-4 rounded-xl border p-4">
      <div>
        <h3 className="font-semibold">Zoho forwarding destinations</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Creates exact Cloudflare ingress routes for active Mkety root mailboxes except hello@mkety.com. Keep the root Zoho MX records. Then add matching verified forwards in Zoho to the addresses below.
        </p>
      </div>
      <button className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground" disabled={pending}>
        {pending ? 'Configuring…' : 'Configure Cloudflare ingress routes'}
      </button>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      {state.configuredAddresses?.length ? (
        <div className="space-y-1 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
          <p className="font-semibold">Add these forwards in Zoho</p>
          {state.configuredAddresses.map((address) => (
            <code className="block" key={address}>{address}</code>
          ))}
          <p className="pt-2 text-muted-foreground">Forward each root mailbox to its matching address above. Leave hello@mkety.com in Zoho.</p>
        </div>
      ) : null}
    </form>
  );
}

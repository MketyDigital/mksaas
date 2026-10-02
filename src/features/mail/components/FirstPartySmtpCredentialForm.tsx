'use client';

import { useActionState } from 'react';

import { createFirstPartySmtpCredential } from '@/features/mail/server/admin-actions';

export function FirstPartySmtpCredentialForm({ tenant }: { tenant: string }) {
  const initialState: { secret?: string; error?: string } = {};
  const [state, action, pending] = useActionState(createFirstPartySmtpCredential.bind(null, tenant), initialState);
  return (
    <form action={action} className="space-y-4 rounded-xl border p-4">
      <div>
        <h3 className="font-semibold">First-party SMTP credential</h3>
        <p className="mt-1 text-sm text-muted-foreground">Creates an SMTP-only password for the verified info@mkety.com mailbox. The password appears once. Customer external mail clients stay disabled.</p>
      </div>
      <button className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground" disabled={pending}>
        {pending ? 'Creating…' : 'Create first-party SMTP password'}
      </button>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      {state.secret ? <div className="rounded-lg border border-primary/20 bg-primary/5 p-3"><p className="font-semibold">Copy this password now</p><code className="mt-2 block break-all rounded bg-background p-3">{state.secret}</code></div> : null}
    </form>
  );
}

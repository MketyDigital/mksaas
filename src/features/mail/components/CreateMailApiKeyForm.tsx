'use client';

import { useActionState } from 'react';

import { createMailApiKey } from '@/features/mail/server/api-key-actions';

export function CreateMailApiKeyForm({tenant}:{tenant:string}){
  const action=createMailApiKey.bind(null,tenant);
  const [state,formAction,pending]=useActionState(action,{});
  return <div className="space-y-4">
    <form action={formAction} className="flex flex-col gap-3 sm:flex-row">
      <input className="min-w-0 flex-1 rounded-xl border bg-background px-4 py-3" name="name" placeholder="Website production" required/>
      <button className="rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground" disabled={pending}>{pending?'Creating…':'Create API key'}</button>
    </form>
    {state.error&&<div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">{state.error}</div>}
    {state.secret&&<div className="rounded-xl border border-primary/20 bg-primary/5 p-4"><p className="font-semibold">Copy this key now</p><p className="mt-1 text-sm text-muted-foreground">For security, Mkety will not show the full key again.</p><code className="mt-3 block overflow-x-auto rounded-lg bg-background p-3 text-sm">{state.secret}</code></div>}
  </div>;
}

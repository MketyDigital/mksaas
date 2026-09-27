'use client';

import { useActionState } from 'react';

import { createMailAppPassword } from '@/features/mail/server/app-password-actions';

export function CreateMailAppPasswordForm({tenant,mailboxes}:{tenant:string;mailboxes:Array<{id:string;address:string}>}){
  const action=createMailAppPassword.bind(null,tenant);
  const [state,formAction,pending]=useActionState(action,{});
  return <div className="space-y-4">
    <form action={formAction} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
      <select className="rounded-xl border bg-background px-4 py-3" name="mailboxId">{mailboxes.map(m=><option key={m.id} value={m.id}>{m.address}</option>)}</select>
      <input className="rounded-xl border bg-background px-4 py-3" name="name" placeholder="My iPhone" required/>
      <button className="rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground" disabled={pending}>{pending?'Creating…':'Create app password'}</button>
    </form>
    {state.error&&<div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">{state.error}</div>}
    {state.secret&&<div className="rounded-xl border border-primary/20 bg-primary/5 p-4"><p className="font-semibold">Copy this password now</p><p className="mt-1 text-sm text-muted-foreground">Use it in your mail app instead of your Mkety account password. It will not be shown again.</p><code className="mt-3 block rounded-lg bg-background p-3 text-sm">{state.secret}</code></div>}
  </div>;
}

'use client';

import { useActionState } from 'react';

import {
  runEnterpriseAiPlayground,
  type EnterpriseAiPlaygroundState,
} from '@/features/ai-runtime/server/playground-actions';
import { Button } from '@/shared/components/ui';

export function EnterpriseAiPlaygroundForm({
  tenant,
  solutions,
}: {
  tenant: string;
  solutions: Array<{ id: string; name: string; status: string }>;
}) {
  const action = runEnterpriseAiPlayground.bind(null, tenant);
  const [state, formAction, pending] = useActionState<EnterpriseAiPlaygroundState, FormData>(action, {});

  return (
    <div className="space-y-5">
      <form action={formAction} className="space-y-4">
        <label className="grid gap-2 text-sm font-medium">
          Solution
          <select className="rounded-xl border bg-background px-3 py-2.5" name="solutionId" required>
            <option value="">Choose a solution</option>
            {solutions.filter((item) => item.status !== 'disabled').map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Customer message
          <textarea
            className="min-h-36 rounded-xl border bg-background p-3 text-sm"
            maxLength={20000}
            name="message"
            placeholder="Type a realistic customer message…"
            required
          />
        </label>
        <Button disabled={pending} type="submit">{pending ? 'Testing…' : 'Run protected test'}</Button>
      </form>

      {state.error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
          {state.error}
          {state.requestId ? <p className="mt-2 font-mono text-xs">Request {state.requestId}</p> : null}
        </div>
      ) : null}

      {state.response ? (
        <div className="rounded-2xl border bg-muted/20 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Assistant response</p>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{state.response}</p>
          {state.requestId ? <p className="mt-4 font-mono text-xs text-muted-foreground">Request {state.requestId}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

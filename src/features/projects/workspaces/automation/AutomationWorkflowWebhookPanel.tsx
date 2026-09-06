'use client';

import { useActionState } from 'react';

import { disableAutomationWorkflowWebhook } from './actions';
import { type AutomationWebhookActionState, createAutomationWorkflowWebhookState, rotateAutomationWorkflowWebhookSecretState } from './webhook-actions';

const initialState: AutomationWebhookActionState = { ok: false };

type Props = {
  canManage: boolean;
  tenantSlug: string;
  projectSlug: string;
  workflowSlug: string;
  workflowTriggerType: string;
  appUrl: string;
  endpoint: { endpointId: string; status: string } | null;
};

function HiddenScope({ tenantSlug, projectSlug, workflowSlug }: Pick<Props, 'tenantSlug' | 'projectSlug' | 'workflowSlug'>) {
  return <><input name="tenantSlug" type="hidden" value={tenantSlug} /><input name="projectSlug" type="hidden" value={projectSlug} /><input name="workflowSlug" type="hidden" value={workflowSlug} /></>;
}

export function AutomationWorkflowWebhookPanel(props: Props) {
  const [createState, createAction, createPending] = useActionState(createAutomationWorkflowWebhookState, initialState);
  const [rotateState, rotateAction, rotatePending] = useActionState(rotateAutomationWorkflowWebhookSecretState, initialState);
  const endpointId = createState.endpointId ?? props.endpoint?.endpointId ?? null;
  const endpointStatus = props.endpoint?.status ?? (createState.ok && createState.endpointId ? 'active' : null);
  const baseUrl = props.appUrl.replace(/\/$/, '');
  const endpointUrl = endpointId ? `${baseUrl}/api/automation/webhooks/${endpointId}` : null;
  const oneTimeSecret = rotateState.secret ?? createState.secret;
  const actionError = rotateState.error ?? createState.error;

  if (!props.canManage) {
    return <section className="rounded-2xl border border-dashed bg-card p-5 md:p-6"><h3 className="text-base font-semibold">Webhook trigger</h3><p className="mt-2 text-sm text-muted-foreground">Only managers can manage webhook endpoints.</p></section>;
  }

  if (props.workflowTriggerType !== 'webhook') {
    return <section className="rounded-2xl border bg-card p-5 md:p-6"><p className="text-sm font-medium text-muted-foreground">External trigger</p><h3 className="mt-1 text-base font-semibold">Webhook trigger</h3><p className="mt-2 text-sm text-muted-foreground">Change the workflow trigger to webhook before creating a public endpoint.</p></section>;
  }

  return <section className="rounded-2xl border bg-card p-5 md:p-6">
    <p className="text-sm font-medium text-muted-foreground">External trigger</p>
    <h3 className="mt-1 text-base font-semibold">Webhook trigger</h3>
    <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Send JSON with <code>X-Mkety-Signature: sha256=&lt;digest&gt;</code>. You may also send <code>X-Mkety-Event-Id</code> for idempotent delivery tracking. The secret is shown only once when created or rotated.</p>

    {endpointUrl ? <div className="mt-4 rounded-lg border bg-muted/30 p-3"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Webhook URL</p><p className="mt-1 break-all font-mono text-sm">{endpointUrl}</p><p className="mt-2 text-xs text-muted-foreground">Status: {endpointStatus}</p></div> : null}

    {oneTimeSecret ? <div className="mt-4 rounded-lg border p-3"><p className="text-sm font-semibold">Copy this secret now</p><p className="mt-1 text-sm text-muted-foreground">It will not be shown again after you leave or refresh this page.</p><p className="mt-2 break-all font-mono text-sm" data-testid="one-time-webhook-secret">{oneTimeSecret}</p></div> : null}
    {actionError ? <p className="mt-3 text-sm text-destructive">{actionError}</p> : null}

    {!endpointId ? <form action={createAction} className="mt-4"><HiddenScope {...props} /><button className="rounded-md border px-3 py-2 text-sm font-medium disabled:opacity-50" disabled={createPending} type="submit">{createPending ? 'Creating…' : 'Create webhook endpoint'}</button></form> : <div className="mt-4 flex flex-wrap gap-2">
      <form action={rotateAction}><HiddenScope {...props} /><input name="endpointId" type="hidden" value={endpointId} /><button className="rounded-md border px-3 py-2 text-sm font-medium disabled:opacity-50" disabled={rotatePending || endpointStatus !== 'active'} type="submit">{rotatePending ? 'Rotating…' : 'Rotate secret'}</button></form>
      <form action={disableAutomationWorkflowWebhook}><HiddenScope {...props} /><input name="endpointId" type="hidden" value={endpointId} /><button className="rounded-md border px-3 py-2 text-sm font-medium disabled:opacity-50" disabled={endpointStatus !== 'active'} type="submit">Disable webhook</button></form>
    </div>}
  </section>;
}

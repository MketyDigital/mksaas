'use client';

import { useActionState } from 'react';

import { sendFirstPartyMailTest } from '@/features/mail/server/admin-actions';

type MailActivityRow = {
  id: string;
  tenantName: string;
  tenantSlug: string;
  messageId: string | null;
  eventType: string;
  recipient: string | null;
  payload: Record<string, unknown>;
  occurredAt: Date;
  messageStatus: string | null;
  providerMessageId: string | null;
};

type MailMessageRow = {
  id: string;
  tenantName: string;
  tenantSlug: string;
  fromAddress: string;
  recipients: string[];
  status: string;
  providerMessageId: string | null;
  createdAt: Date;
  sentAt: Date | null;
};

function maskedEmail(value: string | null | undefined) {
  if (!value) return 'recipient unavailable';
  const [local, domain] = value.split('@');
  if (!local || !domain) return 'address unavailable';
  return `${local.slice(0, 1)}***@${domain}`;
}

function safeDetail(payload: Record<string, unknown>) {
  const delivery = payload.delivery as Record<string, unknown> | undefined;
  const failure = payload.failure as Record<string, unknown> | undefined;
  const rejection = payload.rejection as Record<string, unknown> | undefined;
  const bounce = payload.bounce as Record<string, unknown> | undefined;
  const raw = [
    payload.errorDetail,
    rejection?.detail,
    rejection?.reason,
    failure?.reason,
    bounce?.reason,
    delivery?.smtpResponse,
    delivery?.smtpEnhancedStatusCode,
    delivery?.smtpStatusCode,
  ].find((value) => typeof value === 'string' && value.trim());
  if (typeof raw !== 'string') return '';
  return raw
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[redacted-email]')
    .replace(/\bBearer\s+\S+/gi, 'Bearer [redacted]')
    .replace(/(token|secret|password|api[-_ ]?key)\s*[:=]\s*[^\s,;]+/gi, '$1=[redacted]')
    .replace(/[\r\n\t\u0000-\u001f]+/g, ' ')
    .trim()
    .slice(0, 400);
}

function eventLabel(eventType: string) {
  const labels: Record<string, string> = {
    test_started: 'Test started',
    test_queued: 'Test queued',
    test_failed: 'Test failed',
    sent: 'Accepted by email provider',
    delivered: 'Delivered',
    deferred: 'Deferred by provider',
    bounced: 'Bounced',
    rejected: 'Rejected by provider',
    failed: 'Send failed',
    complained: 'Complaint received',
  };
  return labels[eventType] ?? eventType.replaceAll('_', ' ');
}

export function MailDeliveryDiagnosticsPanel({
  tenant,
  activity,
  recentMessages,
}: {
  tenant: string;
  activity: MailActivityRow[];
  recentMessages: MailMessageRow[];
}) {
  const [state, action, pending] = useActionState(sendFirstPartyMailTest.bind(null, tenant), {});

  return (
    <div className="space-y-5">
      <form action={action} className="space-y-3 rounded-xl border p-4">
        <div>
          <h3 className="font-semibold">Send a real test message</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Sends one message from <code>info@mkety.com</code> through the production Mail queue. The domain must be
            set to <strong>Outbound ready</strong>, Sending enabled, with verified SPF, DKIM and DMARC. This checks
            outbound delivery only; it does not change root MX or enable customer mail clients.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-64 flex-1 text-sm font-medium">
            Send test to
            <input
              autoComplete="email"
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2"
              name="recipient"
              placeholder="you@example.com"
              required
              type="email"
            />
          </label>
          <button className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60" disabled={pending}>
            {pending ? 'Queueing test…' : 'Send test email'}
          </button>
        </div>
        {state.message ? (
          <div className={`rounded-lg border px-3 py-2 text-sm ${state.status === 'error' ? 'border-destructive/30 text-destructive' : 'border-emerald-500/30 text-emerald-700 dark:text-emerald-300'}`}>
            <p>{state.message}</p>
            {state.reference ? <p className="mt-1 font-mono text-xs">Reference: {state.reference}</p> : null}
          </div>
        ) : null}
      </form>

      <div className="space-y-3">
        <div>
          <h3 className="font-semibold">Delivery events and provider errors</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Queue acceptance, provider response, delivery, bounce, rejection and failure events. Email addresses are masked here; event IDs and safe provider diagnostics are retained.
          </p>
        </div>
        {activity.length ? activity.map((event) => {
          const detail = safeDetail(event.payload);
          return (
            <article className="rounded-xl border p-3" key={event.id}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{eventLabel(event.eventType)} · {event.tenantName}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {maskedEmail(event.recipient)} · {new Date(event.occurredAt).toLocaleString()}
                  </p>
                </div>
                <span className="rounded-full bg-muted px-2.5 py-1 text-xs">{event.messageStatus ?? event.eventType}</span>
              </div>
              {detail ? <p className="mt-2 break-words rounded-lg bg-muted/50 p-2 text-sm">{detail}</p> : null}
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground">
                {event.messageId ? <span>Message {event.messageId}</span> : null}
                {event.providerMessageId ? <span>Provider {event.providerMessageId}</span> : null}
                {typeof event.payload.errorCode === 'string' ? <span>Code {event.payload.errorCode}</span> : null}
              </div>
            </article>
          );
        }) : <p className="rounded-xl border p-4 text-sm text-muted-foreground">No delivery events recorded yet.</p>}
      </div>

      <div className="space-y-3">
        <div>
          <h3 className="font-semibold">Recent outbound messages</h3>
          <p className="mt-1 text-sm text-muted-foreground">Messages still queued or without a provider response remain visible here.</p>
        </div>
        {recentMessages.length ? recentMessages.map((message) => (
          <article className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3" key={message.id}>
            <div>
              <p className="font-medium">{message.tenantName} · {message.status}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {maskedEmail(message.fromAddress)} → {(message.recipients ?? []).map(maskedEmail).join(', ') || 'recipient unavailable'} · {new Date(message.createdAt).toLocaleString()}
              </p>
            </div>
            <span className="font-mono text-[11px] text-muted-foreground">{message.id}</span>
          </article>
        )) : <p className="rounded-xl border p-4 text-sm text-muted-foreground">No outbound messages recorded yet.</p>}
      </div>
    </div>
  );
}

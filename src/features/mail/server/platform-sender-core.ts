export const PLATFORM_MAIL_CATEGORIES = [
  'invitation',
  'account_security',
  'billing',
  'payment',
  'domain_status',
  'product_status',
  'support_acknowledgement',
  'support_reply',
] as const;

export type PlatformMailCategory = (typeof PLATFORM_MAIL_CATEGORIES)[number];

export const FIRST_PARTY_MAIL_FROM = 'info@mkety.com';
export const FIRST_PARTY_MAIL_REPLY_TO = 'support@mkety.com';

export function isFirstPartyMailSendingDomainReady(input: { status: string; sendingEnabled: boolean; spfStatus: string; dkimStatus: string; dmarcStatus: string; }) {
  return input.status === 'sending_ready' && input.sendingEnabled && input.spfStatus === 'verified' && input.dkimStatus === 'verified' && input.dmarcStatus === 'verified';
}

export type PlatformMailInput = {
  category: unknown;
  to: unknown;
  subject: unknown;
  text: unknown;
  html?: unknown;
  idempotencyKey: unknown;
};

type PlatformMailMessage = {
  tenantId: string;
  mailboxId: string;
  domainId: string;
  from: string;
  to: string;
  category: PlatformMailCategory;
  idempotencyKey: string;
  subject: string;
  text: string;
  html: string;
  status: 'queued';
};

type ResolvedSender = {
  tenantId: string;
  mailboxId: string;
  domainId: string;
  from: string;
  workspaceActive: boolean;
  entitled: boolean;
  domainReady: boolean;
} | null;

export type PlatformMailSenderDependencies = {
  resolve: () => Promise<ResolvedSender>;
  isSuppressed: (tenantId: string, email: string) => Promise<boolean>;
  hasCapacity: (tenantId: string, domainId: string) => Promise<boolean>;
  findByIdempotencyKey: (tenantId: string, key: string) => Promise<{ id: string; status: string } | null>;
  createMessage: (message: PlatformMailMessage) => Promise<{ id: string; duplicate?: boolean; status?: string }>;
  retryFailedMessage: (messageId: string) => Promise<boolean>;
  enqueue: (message: {
    kind: 'transactional';
    tenantId: string;
    messageId: string;
    mailboxId: string;
    from: { email: string };
    to: { email: string };
    replyTo: { email: string };
    subject: string;
    text: string;
    html?: string;
  }) => Promise<void>;
  setMessageStatus: (messageId: string, status: 'failed') => Promise<void>;
};

function normalizeEmail(value: unknown) {
  const normalized = String(value ?? '').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : '';
}

export async function sendPlatformMailWithDependencies(
  input: PlatformMailInput,
  dependencies: PlatformMailSenderDependencies,
) {
  const to = normalizeEmail(input.to);
  if (!to) return { ok: false as const, reason: 'invalid_recipient' as const };
  if (!PLATFORM_MAIL_CATEGORIES.includes(input.category as PlatformMailCategory)) {
    return { ok: false as const, reason: 'category_not_allowed' as const };
  }
  const category = input.category as PlatformMailCategory;
  const subject = String(input.subject ?? '').trim().slice(0, 500);
  const text = String(input.text ?? '').slice(0, 200_000);
  const html = String(input.html ?? '').slice(0, 500_000);
  const idempotencyKey = String(input.idempotencyKey ?? '').trim().slice(0, 255);
  if (!subject || (!text.trim() && !html.trim()) || !idempotencyKey) {
    return { ok: false as const, reason: 'invalid_request' as const };
  }

  const sender = await dependencies.resolve();
  if (!sender?.workspaceActive || !sender.entitled || !sender.domainReady || sender.from !== FIRST_PARTY_MAIL_FROM) {
    return { ok: false as const, reason: 'not_ready' as const };
  }

  const existing = await dependencies.findByIdempotencyKey(sender.tenantId, idempotencyKey);
  if (existing && existing.status !== 'failed') {
    return { ok: true as const, messageId: existing.id, status: 'duplicate' as const };
  }
  if (await dependencies.isSuppressed(sender.tenantId, to)) return { ok: false as const, reason: 'suppressed' as const };
  if (!(await dependencies.hasCapacity(sender.tenantId, sender.domainId))) {
    return { ok: false as const, reason: 'rate_limited' as const };
  }

  const enqueueMessage = async (messageId: string) => {
    try {
      await dependencies.enqueue({
        kind: 'transactional',
        tenantId: sender.tenantId,
        messageId,
        mailboxId: sender.mailboxId,
        from: { email: sender.from },
        to: { email: to },
        replyTo: { email: FIRST_PARTY_MAIL_REPLY_TO },
        subject,
        text,
        ...(html ? { html } : {}),
      });
      return true;
    } catch {
      await dependencies.setMessageStatus(messageId, 'failed').catch(() => undefined);
      return false;
    }
  };

  const retryFailed = async (messageId: string) => {
    if (!(await dependencies.retryFailedMessage(messageId))) {
      return { ok: true as const, messageId, status: 'duplicate' as const };
    }
    if (!(await enqueueMessage(messageId))) return { ok: false as const, reason: 'queue_failed' as const };
    return { ok: true as const, messageId, status: 'queued' as const };
  };

  if (existing) return retryFailed(existing.id);

  const message = await dependencies.createMessage({
    tenantId: sender.tenantId,
    mailboxId: sender.mailboxId,
    domainId: sender.domainId,
    from: sender.from,
    to,
    category,
    idempotencyKey,
    subject,
    text,
    html,
    status: 'queued',
  });
  if (message.duplicate) {
    if (message.status === 'failed') return retryFailed(message.id);
    return { ok: true as const, messageId: message.id, status: 'duplicate' as const };
  }

  if (!(await enqueueMessage(message.id))) return { ok: false as const, reason: 'queue_failed' as const };
  return { ok: true as const, messageId: message.id, status: 'queued' as const };
}

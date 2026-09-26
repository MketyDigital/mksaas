import { env } from '@/shared/lib/env';

export interface TransactionalEmailRecipient {
  email: string;
  name?: string | null;
}

export interface TransactionalEmailInput {
  to: TransactionalEmailRecipient[];
  subject: string;
  htmlContent?: string;
  textContent?: string;
  replyTo?: TransactionalEmailRecipient;
  tags?: string[];
}

export interface TransactionalEmailResult {
  deliveredToProvider: boolean;
  provider: 'brevo' | 'disabled';
  messageId?: string;
}

function isConfigured(): boolean {
  return Boolean(env.BREVO_API_KEY && env.BREVO_SENDER_EMAIL);
}

export async function sendTransactionalEmail(input: TransactionalEmailInput): Promise<TransactionalEmailResult> {
  if (!isConfigured()) {
    return { deliveredToProvider: false, provider: 'disabled' };
  }

  if (!input.htmlContent && !input.textContent) {
    throw new Error('Transactional email requires htmlContent or textContent');
  }

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'api-key': env.BREVO_API_KEY!,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      sender: {
        email: env.BREVO_SENDER_EMAIL!,
        name: env.BREVO_SENDER_NAME || 'Mkety',
      },
      to: input.to.map((recipient) => ({
        email: recipient.email,
        ...(recipient.name ? { name: recipient.name } : {}),
      })),
      subject: input.subject,
      ...(input.htmlContent ? { htmlContent: input.htmlContent } : {}),
      ...(input.textContent ? { textContent: input.textContent } : {}),
      replyTo: input.replyTo
        ? {
            email: input.replyTo.email,
            ...(input.replyTo.name ? { name: input.replyTo.name } : {}),
          }
        : env.BREVO_REPLY_TO_EMAIL
          ? { email: env.BREVO_REPLY_TO_EMAIL, name: 'Mkety Support' }
          : undefined,
      ...(input.tags?.length ? { tags: input.tags } : {}),
    }),
  });

  const payload = (await response.json().catch(() => null)) as { messageId?: string; message?: string } | null;
  if (!response.ok) {
    throw new Error(`Brevo transactional email failed (${response.status}): ${payload?.message ?? 'unknown error'}`);
  }

  return {
    deliveredToProvider: true,
    provider: 'brevo',
    messageId: payload?.messageId,
  };
}

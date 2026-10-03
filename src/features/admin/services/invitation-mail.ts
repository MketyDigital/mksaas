import { createHash } from 'node:crypto';

import type { PlatformMailInput } from '@/features/mail/server/platform-sender-core';

type TenantInvitationMail = {
  id: string;
  email: string;
  token: string;
  firstName: string | null;
  message: string | null;
  expiresAt: Date;
  inviteUrl: string;
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]!);
}

export async function deliverTenantInvitation(
  tenantName: string,
  invite: TenantInvitationMail,
  send: (input: PlatformMailInput) => Promise<{ ok: boolean }> = (input) => import('@/features/mail/server/platform-sender').then(({ sendPlatformMail }) => sendPlatformMail(input)),
): Promise<'queued' | 'pending'> {
  const expiry = new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' }).format(invite.expiresAt);
  const safeTenantName = escapeHtml(tenantName);
  const greeting = invite.firstName ? `Hello ${invite.firstName},` : 'Hello,';
  const optionalMessage = invite.message?.trim() ? `\n\nMessage from ${tenantName}:\n${invite.message.trim()}` : '';
  const text = `${greeting}\n\n${tenantName} invited you to join their Mkety workspace.\n\nAccept the invitation: ${invite.inviteUrl}\n\nThis invitation expires on ${expiry}.${optionalMessage}`;
  const html = `<p>${escapeHtml(greeting)}</p><p>${safeTenantName} invited you to join their Mkety workspace.</p>${invite.message?.trim() ? `<blockquote>${escapeHtml(invite.message.trim())}</blockquote>` : ''}<p><a href="${escapeHtml(invite.inviteUrl)}">Accept invitation</a></p><p>This invitation expires on ${escapeHtml(expiry)}.</p>`;
  const tokenDigest = createHash('sha256').update(invite.token).digest('hex');
  try {
    const result = await send({
      category: 'invitation',
      to: invite.email,
      subject: `${tenantName} invited you to Mkety`,
      text,
      html,
      idempotencyKey: `invitation:${invite.id}:${tokenDigest}`,
    });
    return result.ok ? 'queued' : 'pending';
  } catch {
    return 'pending';
  }
}

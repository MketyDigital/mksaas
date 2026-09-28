import type { EnterpriseAiChannelCredentials } from './credentials';
import type { LinkedInCommunityNotification } from './inbound';

function required(value: string | undefined, label: string) {
  if (!value) throw new Error(`${label} is not configured.`);
  return value;
}

function parseCommentUrn(urn: string) {
  const match = urn.match(/^urn:li:comment:\((.+),(\d+)\)$/);
  if (!match) return null;
  return { threadUrn: match[1], commentId: match[2] };
}

function linkedinHeaders(credentials: EnterpriseAiChannelCredentials, version: string) {
  return {
    Authorization: `Bearer ${required(credentials.accessToken, 'LinkedIn access token')}`,
    'Linkedin-Version': version,
    'X-RestLi-Protocol-Version': '2.0.0',
    'Content-Type': 'application/json',
  };
}

export async function resolveLinkedInCommunityNotification(input: {
  notification: LinkedInCommunityNotification;
  credentials: EnterpriseAiChannelCredentials;
  version?: string;
}) {
  const version = input.version ?? '202609';
  const generated = input.notification.generatedActivityUrn;
  if (!generated) return null;

  const parsed = parseCommentUrn(generated);
  if (!parsed) return null;

  const url =
    `https://api.linkedin.com/rest/socialActions/${encodeURIComponent(parsed.threadUrn)}/comments/${encodeURIComponent(parsed.commentId)}`;
  const response = await fetch(url, {
    headers: linkedinHeaders(input.credentials, version),
  });
  if (!response.ok) {
    throw new Error(`LinkedIn comment retrieval failed with HTTP ${response.status}.`);
  }
  const payload = await response.json() as Record<string, unknown>;
  const message = payload.message as Record<string, unknown> | undefined;
  const actor = typeof payload.actor === 'string' ? payload.actor : 'linkedin-member';
  const text = typeof message?.text === 'string' ? message.text.trim() : '';
  if (!text) return null;

  return {
    senderId: actor,
    conversationId: input.notification.sourcePostUrn ?? parsed.threadUrn,
    providerMessageId: input.notification.notificationId,
    text,
    replyRecipientId: generated,
  };
}

import { createHmac, createPublicKey, timingSafeEqual, verify as verifySignature } from 'node:crypto';

import type { EnterpriseAiChannelCredentials } from './credentials';
import type { EnterpriseAiChannelKey } from './registry';

export type EnterpriseAiInboundAttachment = {
  kind: 'image' | 'audio' | 'document';
  providerFileId: string;
  mimeType?: string;
  fileName?: string;
  sizeBytes?: number;
  durationSeconds?: number;
};

export type NormalizedEnterpriseAiInbound = {
  senderId: string;
  conversationId: string;
  providerMessageId: string;
  text: string;
  replyRecipientId: string;
  attachments?: EnterpriseAiInboundAttachment[];
};

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function hmacHex(secret: string, payload: string) {
  return createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
}

function requireString(value: unknown, label: string) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} is missing.`);
  return value.trim();
}

function verifyTelegram(headers: Headers, credentials: EnterpriseAiChannelCredentials) {
  const expected = credentials.webhookSecret;
  if (!expected) throw new Error('Telegram webhook secret is not configured.');
  const supplied = headers.get('x-telegram-bot-api-secret-token') ?? '';
  if (!safeEqual(supplied, expected)) throw new Error('Telegram webhook authentication failed.');
}

function verifySlack(rawBody: string, headers: Headers, credentials: EnterpriseAiChannelCredentials, now = Date.now()) {
  const signingSecret = credentials.signingSecret;
  if (!signingSecret) throw new Error('Slack signing secret is not configured.');
  const timestamp = headers.get('x-slack-request-timestamp') ?? '';
  const supplied = headers.get('x-slack-signature') ?? '';
  const seconds = Number(timestamp);
  if (!Number.isFinite(seconds) || Math.abs(now / 1000 - seconds) > 300) {
    throw new Error('Slack webhook timestamp is invalid.');
  }
  const expected = `v0=${hmacHex(signingSecret, `v0:${timestamp}:${rawBody}`)}`;
  if (!safeEqual(supplied, expected)) throw new Error('Slack webhook authentication failed.');
}

function verifyMeta(rawBody: string, headers: Headers, credentials: EnterpriseAiChannelCredentials) {
  const appSecret = credentials.appSecret;
  if (!appSecret) throw new Error('Meta app secret is not configured.');
  const supplied = headers.get('x-hub-signature-256') ?? '';
  const expected = `sha256=${hmacHex(appSecret, rawBody)}`;
  if (!safeEqual(supplied, expected)) throw new Error('Meta webhook authentication failed.');
}

function verifyCustom(rawBody: string, headers: Headers, credentials: EnterpriseAiChannelCredentials) {
  const secret = credentials.webhookSecret;
  if (!secret) throw new Error('Custom webhook secret is not configured.');
  const timestamp = headers.get('x-mkety-timestamp') ?? '';
  const supplied = headers.get('x-mkety-signature-256') ?? '';
  const expected = `sha256=${hmacHex(secret, rawBody)}`;
  if (!timestamp || !safeEqual(supplied, expected)) throw new Error('Custom webhook authentication failed.');
}


export function verifyDiscordInteraction(rawBody: string, headers: Headers, credentials: EnterpriseAiChannelCredentials) {
  const publicKey = credentials.publicKey;
  if (!publicKey || !/^[0-9a-fA-F]{64}$/.test(publicKey)) {
    throw new Error('Discord application public key is not configured.');
  }
  const signature = headers.get('x-signature-ed25519') ?? '';
  const timestamp = headers.get('x-signature-timestamp') ?? '';
  if (!/^[0-9a-fA-F]{128}$/.test(signature) || !timestamp) {
    throw new Error('Discord interaction signature is missing.');
  }
  const rawKey = Buffer.from(publicKey, 'hex');
  const derKey = Buffer.concat([
    Buffer.from('302a300506032b6570032100', 'hex'),
    rawKey,
  ]);
  const key = createPublicKey({ key: derKey, format: 'der', type: 'spki' });
  const valid = verifySignature(
    null,
    Buffer.from(timestamp + rawBody, 'utf8'),
    key,
    Buffer.from(signature, 'hex'),
  );
  if (!valid) throw new Error('Discord interaction authentication failed.');
}

export function normalizeDiscordInteraction(payload: Record<string, unknown>): NormalizedEnterpriseAiInbound {
  if (payload.type !== 2) throw new Error('Discord interaction type is not a chat command.');
  const member = payload.member as Record<string, unknown> | undefined;
  const user = (member?.user ?? payload.user) as Record<string, unknown> | undefined;
  const data = payload.data as Record<string, unknown> | undefined;
  const options = Array.isArray(data?.options) ? data.options as Array<Record<string, unknown>> : [];
  const firstString = options.find((option) => option.type === 3 && typeof option.value === 'string');
  const text = requireString(firstString?.value, 'Discord command text');
  return {
    senderId: requireString(user?.id, 'Discord user ID'),
    conversationId: String(payload.channel_id ?? payload.guild_id ?? user?.id ?? ''),
    providerMessageId: requireString(payload.id, 'Discord interaction ID'),
    text,
    replyRecipientId: String(payload.channel_id ?? ''),
  };
}

function verifyLinkedIn(rawBody: string, headers: Headers, credentials: EnterpriseAiChannelCredentials) {
  const clientSecret = credentials.clientSecret;
  if (!clientSecret) throw new Error('LinkedIn client secret is not configured.');
  const supplied = headers.get('x-li-signature') ?? '';
  const expected = hmacHex(clientSecret, `hmacsha256=${rawBody}`);
  if (!safeEqual(supplied, expected)) throw new Error('LinkedIn webhook authentication failed.');
}

export function verifyLinkedInWebhookChallenge(url: URL, credentials: EnterpriseAiChannelCredentials) {
  const challengeCode = url.searchParams.get('challengeCode');
  if (!challengeCode || !credentials.clientSecret) {
    throw new Error('LinkedIn webhook validation failed.');
  }
  return {
    challengeCode,
    challengeResponse: hmacHex(credentials.clientSecret, challengeCode),
  };
}

export type LinkedInCommunityNotification = {
  notificationId: string;
  action: string;
  organizationUrn: string;
  sourcePostUrn?: string;
  generatedActivityUrn?: string;
};

export function verifyAndExtractLinkedInCommunityNotifications(input: {
  rawBody: string;
  headers: Headers;
  credentials: EnterpriseAiChannelCredentials;
}) {
  verifyLinkedIn(input.rawBody, input.headers, input.credentials);
  let payload: Record<string, unknown>;
  try { payload = JSON.parse(input.rawBody) as Record<string, unknown>; }
  catch { throw new Error('LinkedIn webhook body is invalid JSON.'); }
  const notifications = Array.isArray(payload.notifications)
    ? payload.notifications as Array<Record<string, unknown>>
    : [];
  return notifications.map((item) => ({
    notificationId: String(item.notificationId ?? ''),
    action: String(item.action ?? ''),
    organizationUrn: String(item.organizationalEntity ?? ''),
    sourcePostUrn: typeof item.sourcePost === 'string' ? item.sourcePost : undefined,
    generatedActivityUrn: typeof item.generatedActivity === 'string' ? item.generatedActivity : undefined,
  })).filter((item) => item.notificationId && item.organizationUrn);
}

function normalizeTelegram(payload: Record<string, unknown>): NormalizedEnterpriseAiInbound {
  const message = (payload.message ?? payload.edited_message) as Record<string, unknown> | undefined;
  if (!message) throw new Error('Telegram message payload is missing.');
  const chat = message.chat as Record<string, unknown> | undefined;
  const from = message.from as Record<string, unknown> | undefined;
  const attachments: EnterpriseAiInboundAttachment[] = [];

  const photos = Array.isArray(message.photo)
    ? message.photo.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    : [];
  const photo = photos
    .filter((item) => typeof item.file_id === 'string' && item.file_id)
    .sort((left, right) => Number(right.file_size ?? 0) - Number(left.file_size ?? 0))[0];
  if (photo) {
    attachments.push({
      kind: 'image',
      providerFileId: String(photo.file_id),
      mimeType: 'image/jpeg',
      ...(Number.isFinite(Number(photo.file_size)) ? { sizeBytes: Number(photo.file_size) } : {}),
    });
  }

  const voice = message.voice && typeof message.voice === 'object'
    ? message.voice as Record<string, unknown>
    : null;
  const audio = message.audio && typeof message.audio === 'object'
    ? message.audio as Record<string, unknown>
    : null;
  const audioSource = voice ?? audio;
  if (audioSource && typeof audioSource.file_id === 'string' && audioSource.file_id) {
    attachments.push({
      kind: 'audio',
      providerFileId: String(audioSource.file_id),
      ...(typeof audioSource.mime_type === 'string' ? { mimeType: audioSource.mime_type } : {}),
      ...(typeof audioSource.file_name === 'string' ? { fileName: audioSource.file_name } : {}),
      ...(Number.isFinite(Number(audioSource.file_size)) ? { sizeBytes: Number(audioSource.file_size) } : {}),
      ...(Number.isFinite(Number(audioSource.duration)) ? { durationSeconds: Number(audioSource.duration) } : {}),
    });
  }

  const document = message.document && typeof message.document === 'object'
    ? message.document as Record<string, unknown>
    : null;
  if (document && typeof document.file_id === 'string' && document.file_id) {
    const mimeType = typeof document.mime_type === 'string' ? document.mime_type : '';
    if (
      mimeType.startsWith('image/') ||
      mimeType === 'application/pdf' ||
      mimeType === 'text/plain' ||
      mimeType === 'text/csv' ||
      mimeType.includes('word') ||
      mimeType.includes('spreadsheet') ||
      mimeType.includes('excel')
    ) {
      attachments.push({
        kind: mimeType.startsWith('image/') ? 'image' : 'document',
        providerFileId: String(document.file_id),
        ...(mimeType ? { mimeType } : {}),
        ...(typeof document.file_name === 'string' ? { fileName: document.file_name } : {}),
        ...(Number.isFinite(Number(document.file_size)) ? { sizeBytes: Number(document.file_size) } : {}),
      });
    }
  }

  const rawText = typeof message.text === 'string'
    ? message.text.trim()
    : typeof message.caption === 'string'
      ? message.caption.trim()
      : '';
  const text = rawText || (
    attachments.some((item) => item.kind === 'audio')
      ? 'Please respond to this voice note.'
      : attachments.length
        ? 'Please analyze the attached content.'
        : ''
  );
  if (!text) throw new Error('Telegram message text or supported attachment is missing.');

  return {
    senderId: String(from?.id ?? chat?.id ?? ''),
    conversationId: String(chat?.id ?? ''),
    providerMessageId: String(message.message_id ?? ''),
    text,
    replyRecipientId: String(chat?.id ?? ''),
    ...(attachments.length ? { attachments: attachments.slice(0, 3) } : {}),
  };
}

function normalizeSlack(payload: Record<string, unknown>): NormalizedEnterpriseAiInbound {
  const event = payload.event as Record<string, unknown> | undefined;
  if (!event || event.type !== 'message' || event.bot_id) throw new Error('Slack message payload is not supported.');
  const user = requireString(event.user, 'Slack user');
  const channel = requireString(event.channel, 'Slack channel');
  const ts = requireString(event.ts, 'Slack message timestamp');
  return {
    senderId: user,
    conversationId: channel,
    providerMessageId: ts,
    text: requireString(event.text, 'Slack message text'),
    replyRecipientId: channel,
  };
}

function firstMetaMessaging(payload: Record<string, unknown>) {
  const entries = Array.isArray(payload.entry) ? payload.entry as Array<Record<string, unknown>> : [];
  return entries;
}

function normalizeMeta(channel: EnterpriseAiChannelKey, payload: Record<string, unknown>): NormalizedEnterpriseAiInbound {
  const entries = firstMetaMessaging(payload);
  if (channel === 'whatsapp') {
    for (const entry of entries) {
      const changes = Array.isArray(entry.changes) ? entry.changes as Array<Record<string, unknown>> : [];
      for (const change of changes) {
        const value = change.value as Record<string, unknown> | undefined;
        const messages = Array.isArray(value?.messages) ? value.messages as Array<Record<string, unknown>> : [];
        const message = messages[0];
        if (!message) continue;
        const text = message.text as Record<string, unknown> | undefined;
        const from = requireString(message.from, 'WhatsApp sender');
        return {
          senderId: from,
          conversationId: from,
          providerMessageId: requireString(message.id, 'WhatsApp message ID'),
          text: requireString(text?.body, 'WhatsApp message text'),
          replyRecipientId: from,
        };
      }
    }
  } else {
    for (const entry of entries) {
      const events = Array.isArray(entry.messaging) ? entry.messaging as Array<Record<string, unknown>> : [];
      const event = events[0];
      if (!event) continue;
      const sender = event.sender as Record<string, unknown> | undefined;
      const message = event.message as Record<string, unknown> | undefined;
      const senderId = requireString(sender?.id, 'Meta sender');
      return {
        senderId,
        conversationId: senderId,
        providerMessageId: requireString(message?.mid, 'Meta message ID'),
        text: requireString(message?.text, 'Meta message text'),
        replyRecipientId: senderId,
      };
    }
  }
  throw new Error('Meta message payload is missing.');
}

function normalizeCustom(payload: Record<string, unknown>): NormalizedEnterpriseAiInbound {
  const senderId = requireString(payload.senderId, 'Webhook sender ID');
  return {
    senderId,
    conversationId: typeof payload.conversationId === 'string' && payload.conversationId
      ? payload.conversationId
      : senderId,
    providerMessageId: requireString(payload.messageId, 'Webhook message ID'),
    text: requireString(payload.text, 'Webhook message text'),
    replyRecipientId: typeof payload.replyRecipientId === 'string' && payload.replyRecipientId
      ? payload.replyRecipientId
      : senderId,
  };
}

export function verifyAndNormalizeEnterpriseAiInbound(input: {
  channel: EnterpriseAiChannelKey;
  rawBody: string;
  headers: Headers;
  credentials: EnterpriseAiChannelCredentials;
  now?: number;
}): NormalizedEnterpriseAiInbound {
  let payload: Record<string, unknown>;
  try { payload = JSON.parse(input.rawBody) as Record<string, unknown>; }
  catch { throw new Error('Channel webhook body is invalid JSON.'); }

  switch (input.channel) {
    case 'telegram':
      verifyTelegram(input.headers, input.credentials);
      return normalizeTelegram(payload);
    case 'slack':
      verifySlack(input.rawBody, input.headers, input.credentials, input.now);
      return normalizeSlack(payload);
    case 'discord':
      verifyDiscordInteraction(input.rawBody, input.headers, input.credentials);
      return normalizeDiscordInteraction(payload);
    case 'whatsapp':
    case 'instagram':
    case 'facebook_messenger':
      verifyMeta(input.rawBody, input.headers, input.credentials);
      return normalizeMeta(input.channel, payload);
    case 'custom_webhook':
      verifyCustom(input.rawBody, input.headers, input.credentials);
      return normalizeCustom(payload);
    case 'website':
    case 'microsoft_teams':
    case 'linkedin_page':
      throw new Error('This channel does not accept this generic webhook ingress contract.');
  }
}

export function verifyMetaWebhookChallenge(url: URL, credentials: EnterpriseAiChannelCredentials) {
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');
  if (
    mode !== 'subscribe' ||
    !credentials.verificationToken ||
    !token ||
    !safeEqual(token, credentials.verificationToken) ||
    !challenge
  ) {
    throw new Error('Meta webhook verification failed.');
  }
  return challenge;
}

import { createHmac, timingSafeEqual } from 'node:crypto';

import type { EnterpriseAiChannelCredentials } from './credentials';
import type { EnterpriseAiChannelKey } from './registry';

export type NormalizedEnterpriseAiInbound = {
  senderId: string;
  conversationId: string;
  providerMessageId: string;
  text: string;
  replyRecipientId: string;
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

function normalizeTelegram(payload: Record<string, unknown>): NormalizedEnterpriseAiInbound {
  const message = (payload.message ?? payload.edited_message) as Record<string, unknown> | undefined;
  if (!message) throw new Error('Telegram message payload is missing.');
  const chat = message.chat as Record<string, unknown> | undefined;
  const from = message.from as Record<string, unknown> | undefined;
  return {
    senderId: String(from?.id ?? chat?.id ?? ''),
    conversationId: String(chat?.id ?? ''),
    providerMessageId: String(message.message_id ?? ''),
    text: requireString(message.text ?? message.caption, 'Telegram message text'),
    replyRecipientId: String(chat?.id ?? ''),
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
      throw new Error('This channel does not accept this webhook ingress contract.');
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

import { assertPublicHttpsUrl } from '@/shared/security/outbound-url';
import type { EnterpriseAiChannelCredentials } from './credentials';
import type { EnterpriseAiChannelKey } from './registry';

export type EnterpriseAiChannelConnection = {
  channel: EnterpriseAiChannelKey;
  endpointUrl: string | null;
  metadata: Record<string, unknown>;
  credentials: EnterpriseAiChannelCredentials;
};

export type EnterpriseAiOutboundMessage = {
  recipientId?: string;
  text: string;
  replyToId?: string;
  contextId?: string;
};

export type EnterpriseAiDeliveryResult = {
  providerMessageId?: string | null;
  rawStatus?: string | null;
};

async function jsonRequest(
  url: string,
  init: RequestInit,
): Promise<Record<string, unknown>> {
  const response = await fetch(url, init);
  let payload: Record<string, unknown> = {};
  try {
    payload = await response.json() as Record<string, unknown>;
  } catch {
    payload = {};
  }
  if (!response.ok) {
    throw new Error(`Channel delivery failed with HTTP ${response.status}.`);
  }
  return payload;
}

function required(value: string | undefined, label: string) {
  if (!value) throw new Error(`${label} is not configured.`);
  return value;
}

function metadataString(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export async function deliverEnterpriseAiChannelMessage(
  connection: EnterpriseAiChannelConnection,
  message: EnterpriseAiOutboundMessage,
): Promise<EnterpriseAiDeliveryResult> {
  switch (connection.channel) {
    case 'website':
      return { rawStatus: 'local' };

    case 'telegram': {
      const botToken = required(connection.credentials.botToken, 'Telegram bot token');
      const chatId = message.recipientId ?? metadataString(connection.metadata, 'channelId');
      const payload = await jsonRequest(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: required(chatId, 'Telegram chat ID'),
          text: message.text,
          ...(message.replyToId ? { reply_parameters: { message_id: Number(message.replyToId) } } : {}),
        }),
      });
      const result = payload.result as Record<string, unknown> | undefined;
      return {
        providerMessageId: result?.message_id !== undefined ? String(result.message_id) : null,
        rawStatus: payload.ok === true ? 'sent' : null,
      };
    }

    case 'slack': {
      const token = required(connection.credentials.accessToken, 'Slack access token');
      const channelId = message.recipientId ?? metadataString(connection.metadata, 'channelId');
      const payload = await jsonRequest('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify({
          channel: required(channelId, 'Slack channel ID'),
          text: message.text,
          ...(message.replyToId ? { thread_ts: message.replyToId } : {}),
        }),
      });
      if (payload.ok !== true) throw new Error('Slack rejected the channel delivery.');
      return {
        providerMessageId: typeof payload.ts === 'string' ? payload.ts : null,
        rawStatus: 'sent',
      };
    }

    case 'whatsapp':
    case 'instagram':
    case 'facebook_messenger': {
      const token = required(connection.credentials.accessToken, 'Meta access token');
      const endpoint = assertPublicHttpsUrl(
        required(connection.endpointUrl ?? undefined, 'Meta messaging endpoint'),
        { label: 'Meta messaging endpoint', allowedHosts: ['graph.facebook.com'] },
      ).toString();
      const recipient = required(message.recipientId, 'Meta recipient ID');
      const body = connection.channel === 'whatsapp'
        ? {
            messaging_product: 'whatsapp',
            to: recipient,
            type: 'text',
            text: { body: message.text },
          }
        : {
            recipient: { id: recipient },
            message: { text: message.text },
          };
      const payload = await jsonRequest(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      const messages = Array.isArray(payload.messages) ? payload.messages as Array<Record<string, unknown>> : [];
      return {
        providerMessageId:
          typeof payload.message_id === 'string'
            ? payload.message_id
            : typeof messages[0]?.id === 'string'
              ? messages[0].id
              : null,
        rawStatus: 'sent',
      };
    }


    case 'discord': {
      const botToken = required(connection.credentials.botToken, 'Discord bot token');
      const channelId = message.recipientId ?? metadataString(connection.metadata, 'channelId');
      const payload = await jsonRequest(
        `https://discord.com/api/v10/channels/${required(channelId, 'Discord channel ID')}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bot ${botToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content: message.text,
            ...(message.replyToId ? { message_reference: { message_id: message.replyToId } } : {}),
            allowed_mentions: { parse: [] },
          }),
        },
      );
      return {
        providerMessageId: typeof payload.id === 'string' ? payload.id : null,
        rawStatus: 'sent',
      };
    }

    case 'linkedin_page': {
      const token = required(connection.credentials.accessToken, 'LinkedIn access token');
      const organizationId = required(metadataString(connection.metadata, 'organizationId'), 'LinkedIn organization ID');
      const version = metadataString(connection.metadata, 'linkedinVersion') ?? '202609';
      const targetUrn = required(message.recipientId, 'LinkedIn post or comment URN');
      const contextUrn = message.contextId ?? targetUrn;
      const encoded = encodeURIComponent(contextUrn);
      const payload = await jsonRequest(
        `https://api.linkedin.com/rest/socialActions/${encoded}/comments`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Linkedin-Version': version,
            'X-Restli-Protocol-Version': '2.0.0',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            actor: `urn:li:organization:${organizationId}`,
            message: { text: message.text },
            object: contextUrn,
            ...(targetUrn !== contextUrn ? { parentComment: targetUrn } : {}),
          }),
        },
      );
      return {
        providerMessageId:
          typeof payload.id === 'string'
            ? payload.id
            : typeof payload.entity === 'string'
              ? payload.entity
              : null,
        rawStatus: 'sent',
      };
    }

    case 'microsoft_teams': {
      const endpoint = assertPublicHttpsUrl(
        required(connection.endpointUrl ?? undefined, 'Microsoft Teams webhook endpoint'),
        {
          label: 'Microsoft Teams webhook endpoint',
          allowedSuffixes: ['.webhook.office.com', '.logic.azure.com', '.powerautomate.com'],
        },
      ).toString();
      await jsonRequest(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: message.text }),
      });
      return { rawStatus: 'sent' };
    }

    case 'custom_webhook': {
      const endpoint = assertPublicHttpsUrl(
        required(connection.endpointUrl ?? undefined, 'Webhook endpoint'),
        { label: 'Webhook endpoint' },
      ).toString();
      const secret = connection.credentials.webhookSecret;
      const timestamp = Date.now().toString();
      const raw = JSON.stringify({
        type: 'ai.message',
        recipientId: message.recipientId ?? null,
        text: message.text,
        replyToId: message.replyToId ?? null,
        timestamp,
      });
      let signature: string | undefined;
      if (secret) {
        const key = await crypto.subtle.importKey(
          'raw',
          new TextEncoder().encode(secret),
          { name: 'HMAC', hash: 'SHA-256' },
          false,
          ['sign'],
        );
        const signed = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(raw));
        signature = Array.from(new Uint8Array(signed), (byte) => byte.toString(16).padStart(2, '0')).join('');
      }
      await jsonRequest(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(signature
            ? {
                'X-Mkety-Timestamp': timestamp,
                'X-Mkety-Signature-256': `sha256=${signature}`,
              }
            : {}),
        },
        body: raw,
      });
      return { rawStatus: 'sent' };
    }
  }
}

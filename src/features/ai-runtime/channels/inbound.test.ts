import { createHmac } from 'node:crypto';

import {
  verifyAndNormalizeEnterpriseAiInbound,
  verifyMetaWebhookChallenge,
} from './inbound';

describe('Enterprise AI channel inbound verification', () => {
  it('authenticates and normalizes Telegram messages', () => {
    const rawBody = JSON.stringify({
      message: {
        message_id: 55,
        from: { id: 1001 },
        chat: { id: 2002 },
        text: 'Hello',
      },
    });
    const headers = new Headers({ 'x-telegram-bot-api-secret-token': 'telegram-secret' });
    expect(verifyAndNormalizeEnterpriseAiInbound({
      channel: 'telegram',
      rawBody,
      headers,
      credentials: { webhookSecret: 'telegram-secret' },
    })).toEqual({
      senderId: '1001',
      conversationId: '2002',
      providerMessageId: '55',
      text: 'Hello',
      replyRecipientId: '2002',
    });
  });

  it('rejects Slack replays outside the five-minute window and verifies valid signatures', () => {
    const now = Date.parse('2026-09-28T10:00:00Z');
    const timestamp = String(now / 1000);
    const rawBody = JSON.stringify({
      event: { type: 'message', user: 'U1', channel: 'C1', ts: '1.2', text: 'Hi' },
    });
    const signature = 'v0=' + createHmac('sha256', 'slack-secret')
      .update(`v0:${timestamp}:${rawBody}`)
      .digest('hex');

    expect(verifyAndNormalizeEnterpriseAiInbound({
      channel: 'slack',
      rawBody,
      headers: new Headers({
        'x-slack-request-timestamp': timestamp,
        'x-slack-signature': signature,
      }),
      credentials: { signingSecret: 'slack-secret' },
      now,
    }).text).toBe('Hi');

    expect(() => verifyAndNormalizeEnterpriseAiInbound({
      channel: 'slack',
      rawBody,
      headers: new Headers({
        'x-slack-request-timestamp': String((now / 1000) - 600),
        'x-slack-signature': signature,
      }),
      credentials: { signingSecret: 'slack-secret' },
      now,
    })).toThrow('timestamp');
  });

  it('verifies Meta HMAC before accepting WhatsApp content', () => {
    const rawBody = JSON.stringify({
      entry: [{
        changes: [{
          value: {
            messages: [{
              from: '15550001111',
              id: 'wamid.1',
              text: { body: 'Need help' },
            }],
          },
        }],
      }],
    });
    const signature = 'sha256=' + createHmac('sha256', 'meta-secret').update(rawBody).digest('hex');
    const result = verifyAndNormalizeEnterpriseAiInbound({
      channel: 'whatsapp',
      rawBody,
      headers: new Headers({ 'x-hub-signature-256': signature }),
      credentials: { appSecret: 'meta-secret' },
    });
    expect(result).toMatchObject({
      senderId: '15550001111',
      providerMessageId: 'wamid.1',
      text: 'Need help',
    });
  });

  it('validates Meta webhook subscription challenge without exposing the token', () => {
    const url = new URL('https://example.test/hook?hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=12345');
    expect(verifyMetaWebhookChallenge(url, { verificationToken: 'verify-me' })).toBe('12345');
  });

  it('verifies signed custom webhook messages', () => {
    const rawBody = JSON.stringify({
      senderId: 'customer-1',
      conversationId: 'thread-1',
      messageId: 'message-1',
      text: 'Question',
    });
    const signature = 'sha256=' + createHmac('sha256', 'hook-secret').update(rawBody).digest('hex');
    expect(verifyAndNormalizeEnterpriseAiInbound({
      channel: 'custom_webhook',
      rawBody,
      headers: new Headers({
        'x-mkety-timestamp': '1',
        'x-mkety-signature-256': signature,
      }),
      credentials: { webhookSecret: 'hook-secret' },
    }).conversationId).toBe('thread-1');
  });
});

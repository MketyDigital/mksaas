import { createHmac, generateKeyPairSync, sign } from 'node:crypto';

import {
  verifyAndExtractLinkedInCommunityNotifications,
  verifyAndNormalizeEnterpriseAiInbound,
  verifyLinkedInWebhookChallenge,
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

  it('normalizes Telegram photos for multimodal processing', () => {
    const rawBody = JSON.stringify({
      message: {
        message_id: 56,
        from: { id: 1001 },
        chat: { id: 2002 },
        caption: 'What is in this image?',
        photo: [
          { file_id: 'small', file_size: 1000 },
          { file_id: 'large', file_size: 5000 },
        ],
      },
    });
    const headers = new Headers({ 'x-telegram-bot-api-secret-token': 'telegram-secret' });
    expect(verifyAndNormalizeEnterpriseAiInbound({
      channel: 'telegram',
      rawBody,
      headers,
      credentials: { webhookSecret: 'telegram-secret' },
    })).toMatchObject({
      text: 'What is in this image?',
      media: [{
        kind: 'image',
        providerFileId: 'large',
        mimeType: 'image/jpeg',
        sizeBytes: 5000,
      }],
    });
  });

  it('normalizes Telegram voice notes without requiring a caption', () => {
    const rawBody = JSON.stringify({
      message: {
        message_id: 57,
        from: { id: 1001 },
        chat: { id: 2002 },
        voice: {
          file_id: 'voice-file',
          file_size: 4096,
          duration: 23,
          mime_type: 'audio/ogg',
        },
      },
    });
    const headers = new Headers({ 'x-telegram-bot-api-secret-token': 'telegram-secret' });
    expect(verifyAndNormalizeEnterpriseAiInbound({
      channel: 'telegram',
      rawBody,
      headers,
      credentials: { webhookSecret: 'telegram-secret' },
    })).toMatchObject({
      text: '[Voice/audio attached]',
      media: [{
        kind: 'audio',
        providerFileId: 'voice-file',
        mimeType: 'audio/ogg',
        sizeBytes: 4096,
        durationSeconds: 23,
      }],
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
  it('verifies Discord Ed25519 interaction signatures before normalization', () => {
    const { publicKey, privateKey } = generateKeyPairSync('ed25519');
    const der = publicKey.export({ format: 'der', type: 'spki' });
    const rawPublicKey = Buffer.from(der).subarray(-32).toString('hex');
    const timestamp = '1727517600';
    const rawBody = JSON.stringify({
      type: 2,
      id: 'interaction-1',
      application_id: 'app-1',
      channel_id: 'channel-1',
      member: { user: { id: 'user-1' } },
      data: { options: [{ type: 3, name: 'question', value: 'How can you help?' }] },
    });
    const signature = sign(null, Buffer.from(timestamp + rawBody), privateKey).toString('hex');

    const result = verifyAndNormalizeEnterpriseAiInbound({
      channel: 'discord',
      rawBody,
      headers: new Headers({
        'x-signature-ed25519': signature,
        'x-signature-timestamp': timestamp,
      }),
      credentials: { publicKey: rawPublicKey },
    });
    expect(result).toMatchObject({
      senderId: 'user-1',
      providerMessageId: 'interaction-1',
      text: 'How can you help?',
    });
  });

  it('verifies LinkedIn challenge and notification HMAC', () => {
    const challengeUrl = new URL('https://example.test/hook?challengeCode=abc123');
    expect(verifyLinkedInWebhookChallenge(challengeUrl, { clientSecret: 'linkedin-secret' })).toEqual({
      challengeCode: 'abc123',
      challengeResponse: createHmac('sha256', 'linkedin-secret').update('abc123').digest('hex'),
    });

    const rawBody = JSON.stringify({
      notifications: [{
        notificationId: 'notification-1',
        action: 'COMMENT',
        organizationalEntity: 'urn:li:organization:123',
        sourcePost: 'urn:li:share:456',
        generatedActivity: 'urn:li:comment:(urn:li:share:456,789)',
      }],
    });
    const signature = createHmac('sha256', 'linkedin-secret')
      .update(`hmacsha256=${rawBody}`)
      .digest('hex');

    expect(verifyAndExtractLinkedInCommunityNotifications({
      rawBody,
      headers: new Headers({ 'x-li-signature': signature }),
      credentials: { clientSecret: 'linkedin-secret' },
    })).toEqual([{
      notificationId: 'notification-1',
      action: 'COMMENT',
      organizationUrn: 'urn:li:organization:123',
      sourcePostUrn: 'urn:li:share:456',
      generatedActivityUrn: 'urn:li:comment:(urn:li:share:456,789)',
    }]);
  });
});

import { ENTERPRISE_AI_CHANNELS } from './registry';

describe('Enterprise AI channel registry', () => {
  it('ships at least seven common customer channels plus a custom extension path', () => {
    expect(ENTERPRISE_AI_CHANNELS.length).toBeGreaterThanOrEqual(8);
    expect(ENTERPRISE_AI_CHANNELS.map((item) => item.key)).toEqual(expect.arrayContaining([
      'website',
      'whatsapp',
      'telegram',
      'instagram',
      'facebook_messenger',
      'slack',
      'microsoft_teams',
      'custom_webhook',
    ]));
  });

  it('keeps channel commercial access entitlement-controlled', () => {
    for (const channel of ENTERPRISE_AI_CHANNELS) {
      expect(channel.entitlement).toMatch(/^ai\.channel\./);
    }
  });
});

import { ENTERPRISE_AI_CHANNELS } from './registry';

describe('Enterprise AI channel registry', () => {
  it('ships major customer channels plus a custom extension path', () => {
    expect(ENTERPRISE_AI_CHANNELS.length).toBeGreaterThanOrEqual(10);
    expect(ENTERPRISE_AI_CHANNELS.map((item) => item.key)).toEqual(expect.arrayContaining([
      'website',
      'whatsapp',
      'telegram',
      'instagram',
      'facebook_messenger',
      'slack',
      'discord',
      'linkedin_page',
      'microsoft_teams',
      'custom_webhook',
    ]));
  });

  it('keeps channel commercial access entitlement-controlled', () => {
    for (const channel of ENTERPRISE_AI_CHANNELS) {
      expect(channel.entitlement).toMatch(/^ai\.channel\./);
    }
  });
  it('only enables commitment reminders on channels with reliable asynchronous outbound', () => {
    const supported = ENTERPRISE_AI_CHANNELS
      .filter((item) => item.supportsCommitmentReminders)
      .map((item) => item.key);

    expect(supported).toEqual(['telegram', 'slack', 'discord', 'custom_webhook']);
    for (const key of ['website', 'whatsapp', 'instagram', 'facebook_messenger', 'linkedin_page', 'microsoft_teams']) {
      expect(ENTERPRISE_AI_CHANNELS.find((item) => item.key === key)?.supportsCommitmentReminders).toBe(false);
    }
  });

});

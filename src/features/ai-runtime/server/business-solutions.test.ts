import { parseEnterpriseAiSolutionConfiguration } from './business-solutions';

describe('Enterprise AI solution configuration', () => {
  it('defaults to conservative pacing and reminder settings', () => {
    expect(parseEnterpriseAiSolutionConfiguration({})).toEqual({
      systemPrompt: '',
      knowledgeText: '',
      defaultModelAlias: 'mkety-economy',
      paused: false,
      replyDelayMode: 'off',
      replyDelayMinSeconds: 0,
      replyDelayMaxSeconds: 0,
      commitmentRemindersEnabled: false,
      reminderTimezone: 'UTC',
      reminderLeadMinutes: 0,
    });
  });

  it('keeps reply pacing bounded to fifteen minutes', () => {
    const parsed = parseEnterpriseAiSolutionConfiguration({
      replyDelayMode: 'range',
      replyDelayMinSeconds: -50,
      replyDelayMaxSeconds: 99999,
    });
    expect(parsed.replyDelayMode).toBe('range');
    expect(parsed.replyDelayMinSeconds).toBe(0);
    expect(parsed.replyDelayMaxSeconds).toBe(900);
  });

  it('keeps reminder lead time bounded to seven days', () => {
    const parsed = parseEnterpriseAiSolutionConfiguration({
      commitmentRemindersEnabled: true,
      reminderTimezone: 'Africa/Lagos',
      reminderLeadMinutes: 999999,
    });
    expect(parsed.commitmentRemindersEnabled).toBe(true);
    expect(parsed.reminderTimezone).toBe('Africa/Lagos');
    expect(parsed.reminderLeadMinutes).toBe(10_080);
  });

  it('does not accept arbitrary reply delay modes', () => {
    expect(parseEnterpriseAiSolutionConfiguration({ replyDelayMode: 'random-unbounded' }).replyDelayMode).toBe('off');
  });
});

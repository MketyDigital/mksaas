import {
  derivePublicConversationTitle,
  PUBLIC_AI_HISTORY_LIMIT,
  PUBLIC_AI_MESSAGE_CONTEXT_LIMIT,
} from './memory';

describe('Public Mkety AI memory policy', () => {
  it('keeps bounded cross-visit conversation and model context limits', () => {
    expect(PUBLIC_AI_HISTORY_LIMIT).toBeGreaterThan(0);
    expect(PUBLIC_AI_HISTORY_LIMIT).toBeLessThanOrEqual(25);
    expect(PUBLIC_AI_MESSAGE_CONTEXT_LIMIT).toBeGreaterThan(0);
    expect(PUBLIC_AI_MESSAGE_CONTEXT_LIMIT).toBeLessThanOrEqual(40);
  });

  it('derives a safe compact conversation title from the visitor message', () => {
    expect(derivePublicConversationTitle('  How do I get started with Mkety Automation?  ')).toBe(
      'How do I get started with Mkety Automation?',
    );
    expect(derivePublicConversationTitle('x'.repeat(100))).toHaveLength(60);
    expect(derivePublicConversationTitle('   ')).toBe('Mkety AI');
  });
});

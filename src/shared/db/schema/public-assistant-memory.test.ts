import {
  publicAIConversations,
  publicAIMemoryFacts,
  publicAIMessages,
  publicAIToolRuns,
  publicAIVisitors,
} from './public-assistant-memory';

describe('Public Mkety AI persistence boundary', () => {
  it('uses dedicated public-assistant tables rather than tenant assistant tables', () => {
    expect(publicAIVisitors[Symbol.for('drizzle:Name')]).toBe('public_ai_visitors');
    expect(publicAIConversations[Symbol.for('drizzle:Name')]).toBe('public_ai_conversations');
    expect(publicAIMessages[Symbol.for('drizzle:Name')]).toBe('public_ai_messages');
    expect(publicAIMemoryFacts[Symbol.for('drizzle:Name')]).toBe('public_ai_memory_facts');
    expect(publicAIToolRuns[Symbol.for('drizzle:Name')]).toBe('public_ai_tool_runs');
  });

  it('does not expose tenant or person ownership columns', () => {
    const conversationColumns = Object.keys(publicAIConversations);
    const visitorColumns = Object.keys(publicAIVisitors);

    expect(conversationColumns).not.toContain('tenantId');
    expect(conversationColumns).not.toContain('personId');
    expect(visitorColumns).not.toContain('tenantId');
    expect(visitorColumns).not.toContain('personId');
  });
});

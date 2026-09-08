import { getTableName } from 'drizzle-orm';

import {
  publicAIConversations,
  publicAIMemoryFacts,
  publicAIMessages,
  publicAIToolRuns,
  publicAIVisitors,
} from './public-assistant-memory';

describe('Public Mkety AI persistence boundary', () => {
  it('uses dedicated public-assistant tables rather than tenant assistant tables', () => {
    expect(getTableName(publicAIVisitors)).toBe('public_ai_visitors');
    expect(getTableName(publicAIConversations)).toBe('public_ai_conversations');
    expect(getTableName(publicAIMessages)).toBe('public_ai_messages');
    expect(getTableName(publicAIMemoryFacts)).toBe('public_ai_memory_facts');
    expect(getTableName(publicAIToolRuns)).toBe('public_ai_tool_runs');
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

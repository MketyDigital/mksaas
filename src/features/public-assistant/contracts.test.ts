import { publicAssistantDeleteSchema, publicAssistantMessageSchema } from './contracts';

describe('Public Mkety AI API contracts', () => {
  it('accepts only the explicit Enterprise sales intent when qualification mode is requested', () => {
    expect(
      publicAssistantMessageSchema.parse({
        message: 'I need help with Trading Workspace',
        intent: 'enterprise-sales',
      }),
    ).toEqual({
      message: 'I need help with Trading Workspace',
      intent: 'enterprise-sales',
    });
    expect(
      publicAssistantMessageSchema.safeParse({
        message: 'I need help',
        intent: 'internal-debug',
      }).success,
    ).toBe(false);
  });

  it('accepts a bounded support question without any provider/model selection', () => {
    expect(publicAssistantMessageSchema.parse({ message: 'How do I get started with Mkety?' })).toEqual({
      message: 'How do I get started with Mkety?',
    });
    expect(() =>
      publicAssistantMessageSchema.parse({ message: 'hello', provider: 'openai', model: 'gpt-5.6-terra' }),
    ).toThrow();
  });

  it('rejects empty and oversized visitor messages', () => {
    expect(() => publicAssistantMessageSchema.parse({ message: '' })).toThrow();
    expect(() => publicAssistantMessageSchema.parse({ message: 'x'.repeat(2001) })).toThrow();
  });

  it('supports deleting one conversation or all browser history', () => {
    expect(publicAssistantDeleteSchema.parse({ scope: 'all' })).toEqual({ scope: 'all' });
    expect(
      publicAssistantDeleteSchema.parse({
        scope: 'conversation',
        conversationId: '2f91d3b1-df4d-4cb2-81be-d03a4309c40a',
      }),
    ).toMatchObject({ scope: 'conversation' });
  });
});

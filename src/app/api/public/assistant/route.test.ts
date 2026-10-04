/** @jest-environment node */

const mockLoggerError = jest.fn();
const mockEnsurePublicAIVisitor = jest.fn();
const mockRunMketyPublicAssistant = jest.fn();

jest.mock('@/shared/lib/logger', () => ({
  createLogger: () => ({ error: mockLoggerError }),
}));

jest.mock('@/features/public-assistant/server/request-database', () => ({
  withPublicAIRequestDatabase: (work: (database: unknown) => unknown) => work({}),
}));

jest.mock('@/features/public-assistant/server/memory', () => ({
  clearPublicAIHistory: jest.fn(),
  deletePublicAIConversation: jest.fn(),
  ensurePublicAIVisitor: mockEnsurePublicAIVisitor,
  getPublicAIConversation: jest.fn(),
  getPublicAIRecentUserMessageCount: jest.fn(),
  listPublicAIConversations: jest.fn(),
  PUBLIC_AI_RATE_LIMIT_PER_MINUTE: 12,
}));

jest.mock('@/features/public-assistant/server/runtime', () => {
  class PublicAssistantRuntimeError extends Error {
    constructor(
      message: string,
      readonly status: number,
    ) {
      super(message);
      this.name = 'PublicAssistantRuntimeError';
    }
  }

  return {
    PublicAssistantRuntimeError,
    runMketyPublicAssistant: mockRunMketyPublicAssistant,
  };
});

jest.mock('@/features/public-assistant/server/visitor', () => ({
  createPublicVisitorToken: jest.fn(),
  parsePublicVisitorToken: jest.fn().mockResolvedValue('11111111-1111-4111-8111-111111111111'),
  PUBLIC_AI_VISITOR_COOKIE: 'mkety_public_ai_visitor',
}));

import { POST } from './route';

describe('Mkety public assistant route diagnostics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.MKETY_PUBLIC_AI_VISITOR_SECRET = 'x'.repeat(32);
  });

  it('marks a deterministic fallback in a response header without changing the public body', async () => {
    mockRunMketyPublicAssistant.mockResolvedValueOnce({
      answer: 'Please email our support team for help.',
      conversationId: 'd9428888-122b-4c09-b2db-8f5f2ca5c9ec',
      deterministicFallback: true,
    });

    const response = await POST(
      new Request('https://mkety.example/api/public/assistant', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: 'Where can I find docs and support?' }),
      }),
    );

    expect(response.headers.get('x-mkety-ai-result')).toBe('fallback');
    expect(await response.json()).toEqual({
      answer: 'Please email our support team for help.',
      conversationId: 'd9428888-122b-4c09-b2db-8f5f2ca5c9ec',
    });
  });

  it('logs the nested database driver cause without exposing query parameters', async () => {
    const driverCause = Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET' });
    mockEnsurePublicAIVisitor.mockRejectedValueOnce(
      Object.assign(new Error('Failed query: insert into public_ai_visitors'), {
        cause: driverCause,
        params: ['visitor-secret-value'],
      }),
    );

    const response = await POST(
      new Request('https://mkety.example/api/public/assistant', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: 'Tell me about Mkety Academy.' }),
      }),
    );

    expect(response.status).toBe(503);
    expect(mockLoggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        errorName: 'Error',
        errorCauseName: 'Error',
        errorCauseMessage: 'read ECONNRESET',
        errorCauseCode: 'ECONNRESET',
      }),
      'Mkety public AI request failed',
    );
    expect(JSON.stringify(mockLoggerError.mock.calls)).not.toContain('visitor-secret-value');
  });
});

import { evaluatePublicAssistantPost } from '../../../../scripts/public-assistant-production-diagnostic';

describe('public assistant production POST diagnostic', () => {
  const validBody = JSON.stringify({
    answer: 'Read the public documentation at https://mkety.com/docs and contact support at info@mkety.com.',
    conversationId: 'd9428888-122b-4c09-b2db-8f5f2ca5c9ec',
  });

  it('accepts a real answer with an HTTP success status', () => {
    expect(evaluatePublicAssistantPost('200', validBody)).toEqual({
      ok: true,
      httpCode: 200,
      reason: null,
    });
  });

  it('treats the deterministic support fallback as unhealthy despite HTTP 200', () => {
    expect(evaluatePublicAssistantPost('200', JSON.stringify({
      answer: 'Mkety AI is temporarily unavailable. You can continue with support by email.',
      conversationId: 'd9428888-122b-4c09-b2db-8f5f2ca5c9ec',
    }))).toEqual({
      ok: false,
      httpCode: 200,
      reason: 'deterministic_fallback',
    });
  });

  it('rejects an invalid response and reports non-200 HTTP status', () => {
    expect(evaluatePublicAssistantPost('200', '{"conversationId":"d9428888-122b-4c09-b2db-8f5f2ca5c9ec"}')).toEqual({
      ok: false,
      httpCode: 200,
      reason: 'invalid_response',
    });
    expect(evaluatePublicAssistantPost('503', '{"error":"unavailable"}')).toEqual({
      ok: false,
      httpCode: 503,
      reason: 'http_error',
    });
  });
});

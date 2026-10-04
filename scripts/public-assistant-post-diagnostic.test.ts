/** @jest-environment node */

const diagnostic = require('./public-assistant-production-diagnostic') as {
  evaluatePublicAssistantPost?: (
    rawHttpCode: string,
    rawBody: string,
  ) => { ok: boolean; httpCode: number | null; reason: string | null };
};

const evaluatePost = diagnostic.evaluatePublicAssistantPost;

describe('public assistant production POST diagnostic', () => {
  const validBody = JSON.stringify({
    answer: 'Read the public documentation at https://mkety.com/docs and contact support at info@mkety.com.',
    conversationId: 'd9428888-122b-4c09-b2db-8f5f2ca5c9ec',
  });

  it('requires a dedicated POST-response evaluator and accepts an actual answer', () => {
    expect(typeof evaluatePost).toBe('function');
    expect(evaluatePost?.('200', validBody)).toEqual({ ok: true, httpCode: 200, reason: null });
  });

  it('treats a deterministic fallback as unhealthy even when the route returns HTTP 200', () => {
    expect(
      evaluatePost?.(
        '200',
        JSON.stringify({
          answer: 'Mkety AI is temporarily unavailable. You can continue with support by email.',
          conversationId: 'd9428888-122b-4c09-b2db-8f5f2ca5c9ec',
        }),
      ),
    ).toEqual({ ok: false, httpCode: 200, reason: 'deterministic_fallback' });
  });

  it('rejects empty, malformed or non-answer POST responses', () => {
    expect(evaluatePost?.('200', '{"conversationId":"d9428888-122b-4c09-b2db-8f5f2ca5c9ec"}')).toEqual({
      ok: false,
      httpCode: 200,
      reason: 'invalid_response',
    });
    expect(evaluatePost?.('503', '{"error":"unavailable"}')).toEqual({
      ok: false,
      httpCode: 503,
      reason: 'http_error',
    });
  });
});

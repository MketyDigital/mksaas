export type HttpProbeEvaluation = {
  ok: boolean;
  httpCode: number | null;
};

export type StructuredProbeEvaluation = {
  ready: boolean;
  ok: boolean;
  httpCode: number | null;
  stage: string | null;
};

export type PublicAssistantPostEvaluation = {
  ok: boolean;
  httpCode: number | null;
  reason: 'http_error' | 'invalid_response' | 'deterministic_fallback' | null;
};

export function evaluateHttpProbe(rawHttpCode: string): HttpProbeEvaluation {
  const trimmed = rawHttpCode.trim();
  if (trimmed.length !== 3 || [...trimmed].some((digit) => digit < '0' || digit > '9')) {
    return { ok: false, httpCode: null };
  }

  const httpCode = Number(trimmed);
  return {
    ok: httpCode === 200,
    httpCode,
  };
}

export function evaluatePublicAssistantPost(
  rawHttpCode: string,
  rawBody: string,
  rawHeaders = '',
): PublicAssistantPostEvaluation {
  const { httpCode } = evaluateHttpProbe(rawHttpCode);
  if (httpCode !== 200) {
    return { ok: false, httpCode, reason: 'http_error' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return { ok: false, httpCode, reason: 'invalid_response' };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, httpCode, reason: 'invalid_response' };
  }

  const record = parsed as Record<string, unknown>;
  if (
    typeof record.answer !== 'string' ||
    !record.answer.trim() ||
    typeof record.conversationId !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(record.conversationId)
  ) {
    return { ok: false, httpCode, reason: 'invalid_response' };
  }

  const isFallbackResponse = rawHeaders
    .split(String.fromCharCode(10))
    .some((line) => line.trim().toLowerCase() === 'x-mkety-ai-result: fallback');
  if (
    isFallbackResponse ||
    /temporarily unavailable|currently unavailable|deterministic fallback/i.test(record.answer)
  ) {
    return { ok: false, httpCode, reason: 'deterministic_fallback' };
  }

  return { ok: true, httpCode, reason: null };
}

export function evaluateStructuredProbe(
  rawHttpCode: string,
  rawBody: string,
): StructuredProbeEvaluation {
  const { httpCode } = evaluateHttpProbe(rawHttpCode);

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return { ready: false, ok: false, httpCode, stage: null };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ready: false, ok: false, httpCode, stage: null };
  }

  const record = parsed as Record<string, unknown>;
  const stage = typeof record.stage === 'string' ? record.stage : null;
  const hasExpectedStage = stage === 'binding' || stage === 'query';
  const hasBooleanOutcome = typeof record.ok === 'boolean';
  const ready =
    (httpCode === 200 || httpCode === 500) && hasExpectedStage && hasBooleanOutcome;

  return {
    ready,
    ok: ready && httpCode === 200 && record.ok === true,
    httpCode,
    stage,
  };
}

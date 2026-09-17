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

export function evaluateHttpProbe(rawHttpCode: string): HttpProbeEvaluation {
  const trimmed = rawHttpCode.trim();
  if (!/^\d{3}$/.test(trimmed)) {
    return { ok: false, httpCode: null };
  }

  const httpCode = Number(trimmed);
  return {
    ok: httpCode === 200,
    httpCode,
  };
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

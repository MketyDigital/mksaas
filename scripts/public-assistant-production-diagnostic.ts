export type HttpProbeEvaluation = {
  ok: boolean;
  httpCode: number | null;
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

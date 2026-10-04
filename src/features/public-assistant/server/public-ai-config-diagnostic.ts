export const PUBLIC_AI_DIAGNOSTIC_PROVIDERS = [
  'workers-ai',
  'openai',
  'azure-openai',
  'gemini',
  'vertex',
  'cloudflare-ai',
  'bedrock',
] as const;

export type PublicAiDiagnosticProvider = (typeof PUBLIC_AI_DIAGNOSTIC_PROVIDERS)[number];

export type PublicAiConfigDiagnostic = {
  configPresent: boolean;
  enabled: boolean | null;
  primaryProvider: PublicAiDiagnosticProvider | null;
  fallbackProviders: PublicAiDiagnosticProvider[];
  hasFallbacks: boolean;
};

const SAFE_PROVIDER_SET: ReadonlySet<string> = new Set(PUBLIC_AI_DIAGNOSTIC_PROVIDERS);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSafeProvider(value: unknown): value is PublicAiDiagnosticProvider {
  return typeof value === 'string' && SAFE_PROVIDER_SET.has(value);
}

/**
 * Reduce stored platform metadata to the small, explicitly allowed production
 * diagnostic shape. Never return arbitrary metadata, model names, or secrets.
 */
export function summarizePublicAiConfig(metadata: unknown): PublicAiConfigDiagnostic {
  const publicConfig = isRecord(metadata) ? metadata.publicAiConfig : undefined;
  if (!isRecord(publicConfig)) {
    return {
      configPresent: false,
      enabled: null,
      primaryProvider: null,
      fallbackProviders: [],
      hasFallbacks: false,
    };
  }

  const primaryProvider = isSafeProvider(publicConfig.primaryProvider)
    ? publicConfig.primaryProvider
    : null;
  const fallbackProviders = Array.isArray(publicConfig.fallbackProviders)
    ? publicConfig.fallbackProviders.filter(isSafeProvider).filter((provider, index, all) => all.indexOf(provider) === index)
    : [];

  return {
    configPresent: true,
    enabled: publicConfig.enabled === true,
    primaryProvider,
    fallbackProviders,
    hasFallbacks: fallbackProviders.length > 0,
  };
}

export type PublicAiConfigDiagnosticEvaluation = {
  ok: boolean;
  httpCode: number | null;
  reason: 'http_error' | 'invalid_response' | null;
  configPresent?: boolean;
  enabled?: boolean | null;
  primaryProvider?: PublicAiDiagnosticProvider | null;
  fallbackProviders?: PublicAiDiagnosticProvider[];
  hasFallbacks?: boolean;
};

const EXPECTED_KEYS = [
  'configPresent',
  'enabled',
  'fallbackProviders',
  'hasFallbacks',
  'primaryProvider',
].sort();

function isPublicAiConfigDiagnostic(value: unknown): value is PublicAiConfigDiagnostic {
  if (!isRecord(value)) return false;
  const keys = Object.keys(value).sort();
  if (keys.length !== EXPECTED_KEYS.length || keys.some((key, index) => key !== EXPECTED_KEYS[index])) {
    return false;
  }
  if (typeof value.configPresent !== 'boolean') return false;
  if (value.enabled !== null && typeof value.enabled !== 'boolean') return false;
  if (value.primaryProvider !== null && !isSafeProvider(value.primaryProvider)) return false;
  if (
    !Array.isArray(value.fallbackProviders) ||
    !value.fallbackProviders.every(isSafeProvider) ||
    new Set(value.fallbackProviders).size !== value.fallbackProviders.length
  ) {
    return false;
  }
  if (typeof value.hasFallbacks !== 'boolean' || value.hasFallbacks !== (value.fallbackProviders.length > 0)) {
    return false;
  }
  if (!value.configPresent) {
    return (
      value.enabled === null &&
      value.primaryProvider === null &&
      value.fallbackProviders.length === 0 &&
      value.hasFallbacks === false
    );
  }
  return typeof value.enabled === 'boolean';
}

export function evaluatePublicAiConfigDiagnostic(
  rawHttpCode: string,
  rawBody: string,
): PublicAiConfigDiagnosticEvaluation {
  const trimmed = rawHttpCode.trim();
  const httpCode =
    trimmed.length === 3 && [...trimmed].every((digit) => digit >= '0' && digit <= '9')
      ? Number(trimmed)
      : null;
  if (httpCode !== 200) {
    return { ok: false, httpCode, reason: 'http_error' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return { ok: false, httpCode, reason: 'invalid_response' };
  }
  if (!isPublicAiConfigDiagnostic(parsed)) {
    return { ok: false, httpCode, reason: 'invalid_response' };
  }

  return {
    ok: true,
    httpCode,
    reason: null,
    configPresent: parsed.configPresent,
    enabled: parsed.enabled,
    primaryProvider: parsed.primaryProvider,
    fallbackProviders: parsed.fallbackProviders,
    hasFallbacks: parsed.hasFallbacks,
  };
}

type WorkerBinding = {
  name?: unknown;
  type?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNamedBinding(value: unknown): value is WorkerBinding {
  return isRecord(value);
}

function getBindings(payload: unknown): WorkerBinding[] {
  if (!isRecord(payload) || !isRecord(payload.result) || !Array.isArray(payload.result.bindings)) {
    return [];
  }
  return payload.result.bindings.filter(isNamedBinding);
}

function getSecretBindings(payload: unknown): WorkerBinding[] {
  if (!isRecord(payload) || !Array.isArray(payload.result)) return [];
  return payload.result.filter(isNamedBinding);
}

export type PublicAiWorkerBindingDiagnostic = {
  aiBindingPresent: boolean;
  gatewayIdBindingPresent: boolean;
};

/**
 * Reduce Cloudflare metadata to two booleans. The API settings and secret
 * responses can contain configuration values, so this function reads only
 * binding names and types and never returns raw response fields.
 */
export function summarizePublicAiWorkerBindings(
  settingsPayload: unknown,
  secretsPayload: unknown,
): PublicAiWorkerBindingDiagnostic {
  const bindings = getBindings(settingsPayload);
  const secrets = getSecretBindings(secretsPayload);

  return {
    aiBindingPresent: bindings.some((binding) => binding.name === 'AI' && binding.type === 'ai'),
    gatewayIdBindingPresent:
      bindings.some(
        (binding) =>
          binding.name === 'MKETY_AI_GATEWAY_ID' &&
          (binding.type === 'plain_text' || binding.type === 'secret_text'),
      ) || secrets.some((secret) => secret.name === 'MKETY_AI_GATEWAY_ID'),
  };
}

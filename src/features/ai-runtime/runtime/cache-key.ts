export interface AiExactCacheKeyInput {
  tenantId: string;
  projectId: string | null;
  agentVersion: string | null;
  modelRouteVersion: string;
  systemInstructionsHash: string;
  normalizedInputHash: string;
  toolKnowledgeVersion: string | null;
  safetyPolicyVersion: string;
  locale?: string | null;
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function buildAiExactCacheKey(input: AiExactCacheKeyInput) {
  const fingerprint = await sha256(JSON.stringify({
    tenantId: input.tenantId,
    projectId: input.projectId,
    agentVersion: input.agentVersion,
    modelRouteVersion: input.modelRouteVersion,
    systemInstructionsHash: input.systemInstructionsHash,
    normalizedInputHash: input.normalizedInputHash,
    toolKnowledgeVersion: input.toolKnowledgeVersion,
    safetyPolicyVersion: input.safetyPolicyVersion,
    locale: input.locale ?? null,
  }));

  return `ai:exact:v1:${input.tenantId}:${fingerprint}`;
}

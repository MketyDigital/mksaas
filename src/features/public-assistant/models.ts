export {
  MKETY_AI_PROVIDER_MODEL_CATALOG_VERSION,
  MKETY_AI_PROVIDER_MODEL_CATALOG,
} from '@/shared/ai/provider-model-catalog';
import {
  MKETY_AI_PROVIDER_MODEL_CATALOG,
  type MketyAiCatalogProviderId,
  type MketyAiModelStatus,
  type MketyAiProviderModelDefinition,
} from '@/shared/ai/provider-model-catalog';

export type PublicAIProviderId = MketyAiCatalogProviderId;
export type PublicAIModelStatus = MketyAiModelStatus;

export interface PublicAIModelDefinition {
  id: string;
  status: PublicAIModelStatus;
}

type PublicAIProviderModelDefinition = MketyAiProviderModelDefinition;

export const PUBLIC_AI_MODEL_REGISTRY: Record<PublicAIProviderId, PublicAIProviderModelDefinition> =
  MKETY_AI_PROVIDER_MODEL_CATALOG;


export function getDefaultPublicAIModel(provider: PublicAIProviderId): string {
  return PUBLIC_AI_MODEL_REGISTRY[provider].defaultModel;
}

export function getPublicAIModelDefinition(
  provider: PublicAIProviderId,
  model: string,
): PublicAIModelDefinition | undefined {
  return PUBLIC_AI_MODEL_REGISTRY[provider].models.find((candidate) => candidate.id === model);
}

export function assertCurrentPublicAIModel(provider: PublicAIProviderId, model: string): PublicAIModelDefinition {
  const definition = getPublicAIModelDefinition(provider, model);
  if (!definition) {
    throw new Error(`${provider}/${model} is not an approved current public AI model.`);
  }

  return definition;
}

/** Validate models selected by a route and repair stale inactive form values. */
export function normalizePublicAIModelSelections(
  inputModels: Partial<Record<PublicAIProviderId, string>>,
  activeProviders: readonly PublicAIProviderId[],
): Partial<Record<PublicAIProviderId, string>> {
  const active = new Set(activeProviders);
  const normalized: Partial<Record<PublicAIProviderId, string>> = {};

  for (const provider of Object.keys(PUBLIC_AI_MODEL_REGISTRY) as PublicAIProviderId[]) {
    const model = inputModels[provider]?.trim();
    if (!model) {
      normalized[provider] = getDefaultPublicAIModel(provider);
    } else if (getPublicAIModelDefinition(provider, model)) {
      normalized[provider] = model;
    } else if (active.has(provider)) {
      assertCurrentPublicAIModel(provider, model);
    } else {
      normalized[provider] = getDefaultPublicAIModel(provider);
    }
  }

  return normalized;
}

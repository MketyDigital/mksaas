import { eq } from 'drizzle-orm';

import {
  listSystemAiProviderConnections,
  resolveSystemAiProviderConnection,
} from '@/features/ai-runtime/server/provider-connections';
import { db } from '@/shared/db/cloudflare';
import { platformAppControlCenterModules } from '@/shared/db/schema/platform-app-experience';

import {
  assertCurrentPublicAIModel,
  getDefaultPublicAIModel,
  type PublicAIProviderId,
} from '../models';
import type { PublicAIProviderTarget } from './gateway';
import { createPublicAIProviderAdapters } from './providers';

const PROVIDERS: readonly PublicAIProviderId[] = [
  'workers-ai',
  'openai',
  'azure-openai',
  'gemini',
  'vertex',
  'cloudflare-ai',
  'bedrock',
];

export interface DynamicPublicAiConfig {
  enabled: boolean;
  primaryProvider: PublicAIProviderId;
  fallbackProviders: PublicAIProviderId[];
  models: Partial<Record<PublicAIProviderId, string>>;
}

function isProvider(value: unknown): value is PublicAIProviderId {
  return typeof value === 'string' && PROVIDERS.includes(value as PublicAIProviderId);
}

export async function getDynamicPublicAiConfig(): Promise<DynamicPublicAiConfig | null> {
  try {
    const row = await db.query.platformAppControlCenterModules.findFirst({
      where: eq(platformAppControlCenterModules.moduleKey, 'ai-operations'),
      columns: { metadataJson: true },
    });
    const metadata = row?.metadataJson;
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
    const raw = (metadata as Record<string, unknown>).publicAiConfig;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;

    const value = raw as Record<string, unknown>;
    const primaryProvider = isProvider(value.primaryProvider) ? value.primaryProvider : 'openai';
    const fallbackProviders = Array.isArray(value.fallbackProviders)
      ? value.fallbackProviders.filter(isProvider)
          .filter((provider, index, providers) => provider !== primaryProvider && providers.indexOf(provider) === index)
      : [];

    const models: Partial<Record<PublicAIProviderId, string>> = {};
    if (value.models && typeof value.models === 'object' && !Array.isArray(value.models)) {
      for (const provider of PROVIDERS) {
        const model = (value.models as Record<string, unknown>)[provider];
        if (typeof model === 'string' && model.trim()) {
          assertCurrentPublicAIModel(provider, model.trim());
          models[provider] = model.trim();
        }
      }
    }

    return {
      enabled: value.enabled === true,
      primaryProvider,
      fallbackProviders,
      models,
    };
  } catch {
    return null;
  }
}

export async function getPublicAiControlOverview() {
  const [config, connections] = await Promise.all([
    getDynamicPublicAiConfig(),
    listSystemAiProviderConnections('public'),
  ]);
  return {
    config: config ?? {
      enabled: false,
      primaryProvider: 'openai' as PublicAIProviderId,
      fallbackProviders: [],
      models: {},
    },
    connections,
  };
}

export async function resolveDynamicPublicAiTargets(
  config: DynamicPublicAiConfig,
): Promise<PublicAIProviderTarget[]> {
  const providers = [config.primaryProvider, ...config.fallbackProviders];

  const targets: PublicAIProviderTarget[] = [];
  for (const provider of providers) {
    if (provider === 'workers-ai') {
      const adapter = createPublicAIProviderAdapters(['workers-ai'], {})[0];
      if (adapter) {
        targets.push({
          adapter,
          model: config.models[provider] ?? getDefaultPublicAIModel(provider),
        });
      }
      continue;
    }

    try {
      const { adapter } = await resolveSystemAiProviderConnection({
        mode: 'public',
        providerKey: provider,
      });
      targets.push({
        adapter: {
          id: provider,
          generate: (request) => adapter.generate(request),
        },
        model: config.models[provider] ?? getDefaultPublicAIModel(provider),
      });
    } catch {
      // Missing/disabled public provider is skipped. Public AI's bounded gateway
      // may use the next explicitly configured public fallback, never tenant BYOK.
    }
  }
  return targets;
}

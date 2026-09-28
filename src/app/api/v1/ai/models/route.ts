import { eq, inArray } from 'drizzle-orm';

import { authenticateAiApiKey } from '@/features/ai-runtime/server/api-auth';
import { hasEnterpriseAiApiAccess } from '@/features/ai-runtime/server/access';
import { db } from '@/shared/db/cloudflare';
import { aiModelAliases, aiModels } from '@/shared/db/schema';

export async function GET(request: Request) {
  const key = await authenticateAiApiKey(request, 'ai:models:read');
  if (!key) return Response.json({ error: { code: 'unauthorized', message: 'Invalid API key.' } }, { status: 401 });
  if (!(await hasEnterpriseAiApiAccess(key.tenantId))) {
    return Response.json({ error: { code: 'forbidden', message: 'Enterprise AI API access is not enabled.' } }, { status: 403 });
  }

  const models = await db.query.aiModels.findMany({ where: eq(aiModels.enabled, true) });
  const aliases = models.length
    ? await db.query.aiModelAliases.findMany({ where: inArray(aiModelAliases.modelId, models.map((model) => model.id)) })
    : [];
  const aliasesByModel = new Map<string, string[]>();
  for (const alias of aliases) aliasesByModel.set(alias.modelId, [...(aliasesByModel.get(alias.modelId) ?? []), alias.alias]);

  return Response.json({
    object: 'list',
    data: models.map((model) => ({
      id: aliasesByModel.get(model.id)?.find((alias) => alias.startsWith('mkety-')) ?? model.nativeModel,
      object: 'model',
      owned_by: 'mkety',
      provider: model.providerKey,
      capabilities: model.capabilities,
      limits: model.limits,
      aliases: aliasesByModel.get(model.id) ?? [],
    })),
  });
}

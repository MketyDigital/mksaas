import { and, asc, eq, isNull, or } from 'drizzle-orm';

import { db } from '@/shared/db/cloudflare';
import { aiModelAliases, aiModels, aiRoutes } from '@/shared/db/schema';

export async function resolveAiModelRoute(input: {
  tenantId: string;
  projectId?: string | null;
  requestedModel: string;
}) {
  const alias = await db.query.aiModelAliases.findFirst({
    where: eq(aiModelAliases.alias, input.requestedModel),
  });
  if (!alias) return null;

  const model = await db.query.aiModels.findFirst({
    where: and(eq(aiModels.id, alias.modelId), eq(aiModels.enabled, true)),
  });
  if (!model) return null;

  const projectId = input.projectId ?? null;
  const routes = await db.query.aiRoutes.findMany({
    where: and(
      eq(aiRoutes.modelAlias, alias.alias),
      eq(aiRoutes.enabled, true),
      or(eq(aiRoutes.tenantId, input.tenantId), isNull(aiRoutes.tenantId)),
      projectId === null
        ? isNull(aiRoutes.projectId)
        : or(eq(aiRoutes.projectId, projectId), isNull(aiRoutes.projectId)),
    ),
    orderBy: [asc(aiRoutes.priority)],
  });

  const route = routes
    .sort((a, b) => Number(b.tenantId === input.tenantId) - Number(a.tenantId === input.tenantId)
      || Number(b.projectId === projectId && projectId !== null) - Number(a.projectId === projectId && projectId !== null)
      || a.priority - b.priority)[0];

  return route ? { alias, model, route } : null;
}

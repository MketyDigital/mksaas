import { and, eq } from 'drizzle-orm';

import { hasEnterpriseAiApiAccess } from '@/features/ai-runtime/server/access';
import { authenticateAiApiKey } from '@/features/ai-runtime/server/api-auth';
import { resolveAiModelRoute } from '@/features/ai-runtime/server/model-routing';
import { db } from '@/shared/db/cloudflare';
import { projects } from '@/shared/db/schema';

function errorResponse(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status });
}

export async function GET(request: Request) {
  const key = await authenticateAiApiKey(request, 'ai:models:read');
  if (!key) return errorResponse(401, 'unauthorized', 'Invalid API key.');

  if (!(await hasEnterpriseAiApiAccess(key.tenantId))) {
    return errorResponse(403, 'forbidden', 'Enterprise AI API access is not enabled.');
  }

  const projectHeader = request.headers.get('x-mkety-project-id')?.trim() || null;
  const projectId = key.projectId ?? projectHeader;

  if (key.projectId && projectHeader && projectHeader !== key.projectId) {
    return errorResponse(403, 'project_scope_mismatch', 'API key is not valid for this project.');
  }

  if (projectId) {
    const ownedProject = await db.query.projects.findFirst({
      where: and(eq(projects.id, projectId), eq(projects.tenantId, key.tenantId)),
      columns: { id: true },
    });
    if (!ownedProject) {
      return errorResponse(403, 'project_scope_mismatch', 'Project is not available to this tenant.');
    }
  }

  const aliases = await db.query.aiModelAliases.findMany();
  const resolved = await Promise.all(aliases.map(async (alias) => {
    const route = await resolveAiModelRoute({
      tenantId: key.tenantId,
      projectId,
      requestedModel: alias.alias,
    });
    return route;
  }));

  const visible = resolved.filter((item): item is NonNullable<typeof item> => item !== null);

  return Response.json({
    object: 'list',
    data: visible.map(({ alias, model }) => ({
      id: alias.alias,
      object: 'model',
      owned_by: 'mkety',
      provider: model.providerKey,
      capabilities: model.capabilities,
      limits: model.limits,
    })),
  });
}

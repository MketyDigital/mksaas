import { type ModelMessage } from 'ai';
import { and, eq } from 'drizzle-orm';

import { runAgent } from '@/features/ai/lib/agent-runtime';
import { db } from '@/shared/db';
import { agents, projects, tenantMemberships, tenants } from '@/shared/db/schema';
import { auth } from '@/shared/lib/auth';
import { env } from '@/shared/lib/env';
import { logger } from '@/shared/lib/logger';

export const maxDuration = 30;

export async function POST(req: Request, { params }: { params: Promise<{ agentId: string }> }) {
  if (!env.ENABLE_AI_FEATURES) {
    return new Response('AI features are disabled until ENABLE_AI_FEATURES=true.', { status: 503 });
  }

  const session = await auth();
  if (!session?.user?.id) return new Response('Unauthorized', { status: 401 });

  const { agentId } = await params;
  const body = (await req.json()) as {
    tenantSlug?: string;
    projectSlug?: string;
    messages?: ModelMessage[];
  };

  if (!body.tenantSlug || !body.projectSlug || !Array.isArray(body.messages)) {
    return new Response('tenantSlug, projectSlug and messages are required.', { status: 400 });
  }

  const tenant = await db.query.tenants.findFirst({ where: eq(tenants.slug, body.tenantSlug) });
  if (!tenant) return new Response('Workspace not found.', { status: 404 });

  const membership = await db.query.tenantMemberships.findFirst({
    where: and(eq(tenantMemberships.tenantId, tenant.id), eq(tenantMemberships.userId, session.user.id)),
  });
  if (!membership) return new Response('Forbidden.', { status: 403 });

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.tenantId, tenant.id), eq(projects.slug, body.projectSlug)),
  });
  if (!project) return new Response('Project not found.', { status: 404 });

  const agent = await db.query.agents.findFirst({
    where: and(eq(agents.id, agentId), eq(agents.tenantId, tenant.id), eq(agents.projectId, project.id)),
  });
  if (!agent) return new Response('Agent not found.', { status: 404 });

  try {
    const result = runAgent(agent, body.messages);
    return result.toTextStreamResponse();
  } catch (error) {
    logger.error({ error, agentId: agent.id, tenantId: tenant.id }, 'Agent runtime failed');
    const message = error instanceof Error ? error.message : 'Agent runtime failed.';
    return new Response(message, { status: 503 });
  }
}

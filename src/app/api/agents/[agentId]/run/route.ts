import { type ModelMessage } from 'ai';
import { and, eq } from 'drizzle-orm';

import { runAgent } from '@/features/ai/lib/agent-runtime';
import { getPublishedAgentVersion } from '@/features/ai/lib/published-agent';
import { db } from '@/shared/db';
import { agents, agentRuns, projects, tenantMemberships, tenants } from '@/shared/db/schema';
import { auth } from '@/shared/lib/auth';
import { env } from '@/shared/lib/env';
import { logger } from '@/shared/lib/logger';

export const maxDuration = 30;

type RunBody = {
  tenantSlug?: string;
  projectSlug?: string;
  messages?: ModelMessage[];
  published?: boolean;
};

export async function POST(req: Request, { params }: { params: Promise<{ agentId: string }> }) {
  if (!env.ENABLE_AI_FEATURES) return new Response('AI features are disabled until ENABLE_AI_FEATURES=true.', { status: 503 });
  const session = await auth();
  if (!session?.user?.id) return new Response('Unauthorized', { status: 401 });
  const { agentId } = await params;
  const body = (await req.json()) as RunBody;
  if (!body.tenantSlug || !body.projectSlug || !Array.isArray(body.messages)) return new Response('tenantSlug, projectSlug and messages are required.', { status: 400 });

  const tenant = await db.query.tenants.findFirst({ where: eq(tenants.slug, body.tenantSlug) });
  if (!tenant) return new Response('Workspace not found.', { status: 404 });
  const membership = await db.query.tenantMemberships.findFirst({ where: and(eq(tenantMemberships.tenantId, tenant.id), eq(tenantMemberships.userId, session.user.id)) });
  if (!membership) return new Response('Forbidden.', { status: 403 });
  const project = await db.query.projects.findFirst({ where: and(eq(projects.tenantId, tenant.id), eq(projects.slug, body.projectSlug)) });
  if (!project) return new Response('Project not found.', { status: 404 });
  const agent = await db.query.agents.findFirst({ where: and(eq(agents.id, agentId), eq(agents.tenantId, tenant.id), eq(agents.projectId, project.id)) });
  if (!agent) return new Response('Agent not found.', { status: 404 });

  let runtimeAgent = agent;
  if (body.published) {
    const published = await getPublishedAgentVersion(tenant.id, project.id, agent.id);
    if (!published) return new Response('No published agent version is available.', { status: 409 });
    runtimeAgent = {
      ...agent,
      name: published.name,
      instructions: published.instructions,
      provider: published.provider,
      model: published.model,
      config: published.config,
      status: 'published',
    };
  }

  const [run] = await db.insert(agentRuns).values({ tenantId: tenant.id, projectId: project.id, agentId: agent.id, status: 'running', messages: body.messages }).returning({ id: agentRuns.id });
  try {
    const result = await runAgent(runtimeAgent, body.messages);
    const response = result.toTextStreamResponse({ headers: { 'x-agent-run-id': run.id } });
    const originalBody = response.body;
    if (originalBody) {
      const [clientStream, persistenceStream] = originalBody.tee();
      void new Response(persistenceStream).text().then(async (output) => {
        await db.update(agentRuns).set({ status: 'completed', output, completedAt: new Date() }).where(eq(agentRuns.id, run.id));
      }).catch(async (error) => {
        await db.update(agentRuns).set({ status: 'error', error: error instanceof Error ? error.message : 'Agent stream failed', completedAt: new Date() }).where(eq(agentRuns.id, run.id));
      });
      return new Response(clientStream, { status: response.status, headers: response.headers });
    }
    return response;
  } catch (error) {
    logger.error({ error, agentId: agent.id, tenantId: tenant.id, runId: run.id }, 'Agent runtime failed');
    const message = error instanceof Error ? error.message : 'Agent runtime failed.';
    await db.update(agentRuns).set({ status: 'error', error: message, completedAt: new Date() }).where(eq(agentRuns.id, run.id));
    return new Response(message, { status: 503, headers: { 'x-agent-run-id': run.id } });
  }
}

'use server';

import { and, eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';

import { publishAgentVersion, snapshotAgentVersion } from '@/features/ai/lib/agent-versioning';
import { db } from '@/shared/db';
import { agents, aiProviderConnections, projects, tenantMemberships } from '@/shared/db/schema';
import { auth } from '@/shared/lib/auth';
import { getTenantBySlug } from '@/shared/lib/tenant';

const legacyProviders = new Set(['openai', 'groq', 'openrouter', 'custom']);
const statuses = new Set(['draft', 'disabled']);

async function requireManager(tenantSlug: string) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) throw new Error('Workspace not found.');
  const membership = await db.query.tenantMemberships.findFirst({
    where: and(eq(tenantMemberships.tenantId, tenant.id), eq(tenantMemberships.userId, session.user.id)),
  });
  if (!membership || !['admin', 'manager'].includes(membership.role)) throw new Error('You do not have permission to manage agents.');
  return tenant;
}

async function getAgentContext(tenantSlug: string, projectSlug: string, agentId: string) {
  const tenant = await requireManager(tenantSlug);
  const project = await db.query.projects.findFirst({ where: and(eq(projects.tenantId, tenant.id), eq(projects.slug, projectSlug)) });
  if (!project) throw new Error('Project not found.');
  const agent = await db.query.agents.findFirst({ where: and(eq(agents.id, agentId), eq(agents.tenantId, tenant.id), eq(agents.projectId, project.id)) });
  if (!agent) throw new Error('Agent not found.');
  return { tenant, project, agent };
}

function validateConfig(value: string) {
  if (!value) return null;

  const parsed: unknown = JSON.parse(value);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Agent configuration must be a JSON object.');

  const config = parsed as Record<string, unknown>;
  if ('temperature' in config && (typeof config.temperature !== 'number' || config.temperature < 0 || config.temperature > 2)) throw new Error('Temperature must be between 0 and 2.');
  if ('maxOutputTokens' in config && (!Number.isInteger(config.maxOutputTokens) || Number(config.maxOutputTokens) < 1 || Number(config.maxOutputTokens) > 16384)) throw new Error('maxOutputTokens must be an integer between 1 and 16384.');
  if ('maxSteps' in config && (!Number.isInteger(config.maxSteps) || Number(config.maxSteps) < 1 || Number(config.maxSteps) > 10)) throw new Error('maxSteps must be an integer between 1 and 10.');
  if ('tools' in config && (!Array.isArray(config.tools) || config.tools.some((tool) => typeof tool !== 'string'))) throw new Error('tools must be an array of tool IDs.');

  return JSON.stringify(config);
}

export async function updateAgent(formData: FormData) {
  const tenantSlug = String(formData.get('tenantSlug') || '');
  const projectSlug = String(formData.get('projectSlug') || '');
  const agentId = String(formData.get('agentId') || '');
  const { tenant, project, agent } = await getAgentContext(tenantSlug, projectSlug, agentId);

  const name = String(formData.get('name') || '').trim();
  const instructions = String(formData.get('instructions') || '').trim();
  const provider = String(formData.get('provider') || 'platform').trim();
  const model = String(formData.get('model') || '').trim();
  const status = String(formData.get('status') || 'draft').trim();
  const rawConfig = String(formData.get('config') || '').trim();

  if (!name) throw new Error('Agent name is required.');
  if (!statuses.has(status)) throw new Error('Save as draft or disabled; publishing is done through a version.');
  if (provider !== 'platform' && provider !== 'workers-ai' && !legacyProviders.has(provider) && !provider.startsWith('byok:')) {
    throw new Error('Invalid AI provider.');
  }
  if (provider.startsWith('byok:')) {
    const connectionId = provider.slice('byok:'.length).trim();
    const connection = connectionId
      ? await db.query.aiProviderConnections.findFirst({ where: and(
          eq(aiProviderConnections.id, connectionId),
          eq(aiProviderConnections.tenantId, tenant.id),
          eq(aiProviderConnections.status, 'active'),
          eq(aiProviderConnections.mode, 'byok'),
        ) })
      : null;
    if (!connection || (connection.projectId && connection.projectId !== project.id)) {
      throw new Error('BYOK provider connection is not available to this project.');
    }
  }

  const config = validateConfig(rawConfig);
  await db.update(agents).set({ name, instructions: instructions || null, provider, model: model || null, status, config, updatedAt: new Date() }).where(eq(agents.id, agent.id));
  redirect(`/app/${tenant.slug}/projects/${project.slug}/agents/${agent.slug}`);
}

export async function createAgentVersion(formData: FormData) {
  const tenantSlug = String(formData.get('tenantSlug') || '');
  const projectSlug = String(formData.get('projectSlug') || '');
  const agentId = String(formData.get('agentId') || '');
  const { tenant, project, agent } = await getAgentContext(tenantSlug, projectSlug, agentId);
  await snapshotAgentVersion({ tenantId: tenant.id, projectId: project.id, agent });
  redirect(`/app/${tenant.slug}/projects/${project.slug}/agents/${agent.slug}`);
}

export async function publishAgentVersionAction(formData: FormData) {
  const tenantSlug = String(formData.get('tenantSlug') || '');
  const projectSlug = String(formData.get('projectSlug') || '');
  const agentId = String(formData.get('agentId') || '');
  const versionId = String(formData.get('versionId') || '');
  const { tenant, project, agent } = await getAgentContext(tenantSlug, projectSlug, agentId);
  if (!versionId) throw new Error('Version is required.');
  await publishAgentVersion(tenant.id, project.id, agent.id, versionId);
  redirect(`/app/${tenant.slug}/projects/${project.slug}/agents/${agent.slug}`);
}

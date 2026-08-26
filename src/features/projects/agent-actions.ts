'use server';

import { and, eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';

import { db } from '@/shared/db';
import { agents, projects, tenantMemberships } from '@/shared/db/schema';
import { auth } from '@/shared/lib/auth';
import { getTenantBySlug } from '@/shared/lib/tenant';

const providers = new Set(['platform', 'openai', 'groq', 'openrouter', 'custom']);
const statuses = new Set(['draft', 'published', 'disabled']);

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

function validateConfig(value: string) {
  if (!value) return null;

  const parsed: unknown = JSON.parse(value);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Agent configuration must be a JSON object.');

  const config = parsed as Record<string, unknown>;
  if ('temperature' in config && (typeof config.temperature !== 'number' || config.temperature < 0 || config.temperature > 2)) {
    throw new Error('Temperature must be between 0 and 2.');
  }
  if ('maxOutputTokens' in config && (!Number.isInteger(config.maxOutputTokens) || Number(config.maxOutputTokens) < 1 || Number(config.maxOutputTokens) > 16384)) {
    throw new Error('maxOutputTokens must be an integer between 1 and 16384.');
  }
  if ('maxSteps' in config && (!Number.isInteger(config.maxSteps) || Number(config.maxSteps) < 1 || Number(config.maxSteps) > 10)) {
    throw new Error('maxSteps must be an integer between 1 and 10.');
  }
  if ('tools' in config && (!Array.isArray(config.tools) || config.tools.some((tool) => typeof tool !== 'string'))) {
    throw new Error('tools must be an array of tool IDs.');
  }

  return JSON.stringify(config);
}

export async function updateAgent(formData: FormData) {
  const tenantSlug = String(formData.get('tenantSlug') || '');
  const projectSlug = String(formData.get('projectSlug') || '');
  const agentId = String(formData.get('agentId') || '');
  const tenant = await requireManager(tenantSlug);

  const project = await db.query.projects.findFirst({ where: and(eq(projects.tenantId, tenant.id), eq(projects.slug, projectSlug)) });
  if (!project) throw new Error('Project not found.');

  const agent = await db.query.agents.findFirst({ where: and(eq(agents.id, agentId), eq(agents.tenantId, tenant.id), eq(agents.projectId, project.id)) });
  if (!agent) throw new Error('Agent not found.');

  const name = String(formData.get('name') || '').trim();
  const instructions = String(formData.get('instructions') || '').trim();
  const provider = String(formData.get('provider') || 'platform').trim();
  const model = String(formData.get('model') || '').trim();
  const status = String(formData.get('status') || 'draft').trim();
  const rawConfig = String(formData.get('config') || '').trim();

  if (!name) throw new Error('Agent name is required.');
  if (!statuses.has(status)) throw new Error('Invalid agent status.');
  if (!providers.has(provider)) throw new Error('Invalid AI provider.');

  const config = validateConfig(rawConfig);

  await db.update(agents).set({
    name,
    instructions: instructions || null,
    provider,
    model: model || null,
    status,
    config,
    updatedAt: new Date(),
  }).where(eq(agents.id, agent.id));

  redirect(`/t/${tenant.slug}/projects/${project.slug}/agents/${agent.slug}`);
}

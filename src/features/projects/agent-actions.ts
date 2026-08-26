'use server';

import { and, eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';

import { db } from '@/shared/db';
import { agents, projects, tenantMemberships } from '@/shared/db/schema';
import { auth } from '@/shared/lib/auth';
import { getTenantBySlug } from '@/shared/lib/tenant';

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
  const config = String(formData.get('config') || '').trim();

  if (!name) throw new Error('Agent name is required.');
  if (!['draft', 'published', 'disabled'].includes(status)) throw new Error('Invalid agent status.');
  if (config) JSON.parse(config);

  await db.update(agents).set({
    name,
    instructions: instructions || null,
    provider: provider || 'platform',
    model: model || null,
    status,
    config: config || null,
    updatedAt: new Date(),
  }).where(eq(agents.id, agent.id));

  redirect(`/t/${tenant.slug}/projects/${project.slug}/agents/${agent.slug}`);
}

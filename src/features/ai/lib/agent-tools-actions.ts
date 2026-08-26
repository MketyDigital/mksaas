'use server';

import { and, eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';

import { db } from '@/shared/db';
import { agentKnowledge, agents, knowledgeDocuments, projects, tenantMemberships } from '@/shared/db/schema';
import { auth } from '@/shared/lib/auth';
import { getTenantBySlug } from '@/shared/lib/tenant';

async function access(tenantSlug: string, projectSlug: string, agentId: string) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) throw new Error('Workspace not found.');
  const membership = await db.query.tenantMemberships.findFirst({ where: and(eq(tenantMemberships.tenantId, tenant.id), eq(tenantMemberships.userId, session.user.id)) });
  if (!membership || !['admin', 'manager'].includes(membership.role)) throw new Error('You do not have permission to configure this agent.');
  const project = await db.query.projects.findFirst({ where: and(eq(projects.tenantId, tenant.id), eq(projects.slug, projectSlug)) });
  const agent = project ? await db.query.agents.findFirst({ where: and(eq(agents.id, agentId), eq(agents.tenantId, tenant.id), eq(agents.projectId, project.id)) }) : null;
  if (!project || !agent) throw new Error('Agent or project not found.');
  return { tenant, project, agent };
}

export async function saveAgentKnowledge(formData: FormData) {
  const tenantSlug = String(formData.get('tenantSlug') || '');
  const projectSlug = String(formData.get('projectSlug') || '');
  const agentId = String(formData.get('agentId') || '');
  const { tenant, project, agent } = await access(tenantSlug, projectSlug, agentId);
  const selected = formData.getAll('documentId').map(String);

  await db.transaction(async (tx) => {
    await tx.delete(agentKnowledge).where(and(eq(agentKnowledge.agentId, agent.id), eq(agentKnowledge.tenantId, tenant.id), eq(agentKnowledge.projectId, project.id)));
    if (selected.length) {
      const docs = await tx.select({ id: knowledgeDocuments.id }).from(knowledgeDocuments).where(and(eq(knowledgeDocuments.tenantId, tenant.id), eq(knowledgeDocuments.projectId, project.id)));
      const allowed = new Set(docs.map((doc) => doc.id));
      const values = selected.filter((id) => allowed.has(id)).map((documentId) => ({ tenantId: tenant.id, projectId: project.id, agentId: agent.id, documentId }));
      if (values.length) await tx.insert(agentKnowledge).values(values);
    }
  });

  redirect(`/t/${tenantSlug}/projects/${projectSlug}/agents/${agent.slug}`);
}

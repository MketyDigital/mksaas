'use server';

import { and, eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';

import { db } from '@/shared/db';
import { knowledgeDocuments, projects, tenantMemberships } from '@/shared/db/schema';
import { auth } from '@/shared/lib/auth';
import { getTenantBySlug } from '@/shared/lib/tenant';
import { ingestKnowledgeText } from './knowledge-ingestion';

async function requireManager(tenantSlug: string) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) throw new Error('Workspace not found.');
  const membership = await db.query.tenantMemberships.findFirst({
    where: and(eq(tenantMemberships.tenantId, tenant.id), eq(tenantMemberships.userId, session.user.id)),
  });
  if (!membership || !['admin', 'manager'].includes(membership.role)) throw new Error('You do not have permission to manage knowledge.');
  return tenant;
}

export async function createKnowledgeDocument(formData: FormData) {
  const tenantSlug = String(formData.get('tenantSlug') || '');
  const projectSlug = String(formData.get('projectSlug') || '');
  const tenant = await requireManager(tenantSlug);
  const project = await db.query.projects.findFirst({ where: and(eq(projects.tenantId, tenant.id), eq(projects.slug, projectSlug)) });
  if (!project) throw new Error('Project not found.');

  const name = String(formData.get('name') || '').trim();
  const description = String(formData.get('description') || '').trim();
  const text = String(formData.get('text') || '').trim();
  if (!name || !text) throw new Error('Knowledge name and text are required.');

  const [document] = await db.insert(knowledgeDocuments).values({
    tenantId: tenant.id,
    projectId: project.id,
    name,
    description: description || null,
    sourceType: 'text',
    status: 'processing',
  }).returning({ id: knowledgeDocuments.id });

  await ingestKnowledgeText({ tenantId: tenant.id, projectId: project.id, documentId: document.id, text });
  redirect(`/t/${tenantSlug}/projects/${projectSlug}/knowledge`);
}

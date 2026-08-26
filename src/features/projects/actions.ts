'use server';

import { and, desc, eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';

import { db } from '@/shared/db';
import { agents, projects, tenantMemberships } from '@/shared/db/schema';
import { auth } from '@/shared/lib/auth';
import { getTenantBySlug } from '@/shared/lib/tenant';

function slugify(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 90);
}

async function requireManager(tenantSlug: string) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) throw new Error('Workspace not found.');
  const membership = await db.query.tenantMemberships.findFirst({
    where: and(eq(tenantMemberships.tenantId, tenant.id), eq(tenantMemberships.userId, session.user.id)),
  });
  if (!membership || !['admin', 'manager'].includes(membership.role)) throw new Error('You do not have permission to manage projects.');
  return { session, tenant };
}

export async function createProject(formData: FormData) {
  const tenantSlug = String(formData.get('tenantSlug') || '');
  const { tenant } = await requireManager(tenantSlug);
  const name = String(formData.get('name') || '').trim();
  const description = String(formData.get('description') || '').trim();
  const type = String(formData.get('type') || 'app').trim();
  const slug = slugify(String(formData.get('slug') || name));
  if (!name || !slug) throw new Error('Project name and slug are required.');

  const existing = await db.query.projects.findFirst({ where: and(eq(projects.tenantId, tenant.id), eq(projects.slug, slug)) });
  if (existing) throw new Error('That project slug is already in use in this workspace.');

  const [project] = await db.insert(projects).values({ tenantId: tenant.id, name, slug, description: description || null, type }).returning();
  redirect(`/t/${tenant.slug}/projects/${project.slug}`);
}

export async function createAgent(formData: FormData) {
  const tenantSlug = String(formData.get('tenantSlug') || '');
  const projectSlug = String(formData.get('projectSlug') || '');
  const { tenant } = await requireManager(tenantSlug);
  const project = await db.query.projects.findFirst({ where: and(eq(projects.tenantId, tenant.id), eq(projects.slug, projectSlug)) });
  if (!project) throw new Error('Project not found.');

  const name = String(formData.get('name') || '').trim();
  const slug = slugify(String(formData.get('slug') || name));
  const instructions = String(formData.get('instructions') || '').trim();
  if (!name || !slug) throw new Error('Agent name and slug are required.');

  const existing = await db.query.agents.findFirst({ where: and(eq(agents.projectId, project.id), eq(agents.slug, slug)) });
  if (existing) throw new Error('That agent slug is already in use in this project.');

  await db.insert(agents).values({ tenantId: tenant.id, projectId: project.id, name, slug, instructions: instructions || null });
  redirect(`/t/${tenant.slug}/projects/${project.slug}`);
}

export async function getProjectsForTenant(tenantSlug: string) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) throw new Error('Workspace not found.');
  const membership = await db.query.tenantMemberships.findFirst({ where: and(eq(tenantMemberships.tenantId, tenant.id), eq(tenantMemberships.userId, session.user.id)) });
  if (!membership) throw new Error('Forbidden');
  return db.query.projects.findMany({ where: eq(projects.tenantId, tenant.id), orderBy: [desc(projects.createdAt)] });
}

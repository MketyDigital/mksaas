import { and, eq } from 'drizzle-orm';
import { db } from '@/shared/db';
import { projects, tenantMemberships, tenants, workflows } from '@/shared/db/schema';
import { auth } from '@/shared/lib/auth';

async function context(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return { error: new Response('Unauthorized', { status: 401 }) };
  const url = new URL(req.url);
  const tenantSlug = url.searchParams.get('tenantSlug');
  const projectSlug = url.searchParams.get('projectSlug');
  if (!tenantSlug || !projectSlug) return { error: new Response('tenantSlug and projectSlug are required.', { status: 400 }) };
  const tenant = await db.query.tenants.findFirst({ where: eq(tenants.slug, tenantSlug) });
  if (!tenant) return { error: new Response('Workspace not found.', { status: 404 }) };
  const membership = await db.query.tenantMemberships.findFirst({ where: and(eq(tenantMemberships.tenantId, tenant.id), eq(tenantMemberships.userId, session.user.id)) });
  if (!membership) return { error: new Response('Forbidden.', { status: 403 }) };
  const project = await db.query.projects.findFirst({ where: and(eq(projects.tenantId, tenant.id), eq(projects.slug, projectSlug)) });
  if (!project) return { error: new Response('Project not found.', { status: 404 }) };
  return { tenant, project };
}

export async function GET(req: Request) {
  const result = await context(req);
  if ('error' in result) return result.error;
  const rows = await db.query.workflows.findMany({ where: and(eq(workflows.tenantId, result.tenant.id), eq(workflows.projectId, result.project.id)) });
  return Response.json(rows);
}

export async function POST(req: Request) {
  const result = await context(req);
  if ('error' in result) return result.error;
  const body = (await req.json()) as { name?: string; slug?: string; description?: string; triggerType?: string; definition?: unknown; status?: string; webhookSecret?: string };
  if (!body.name || !body.slug) return new Response('name and slug are required.', { status: 400 });
  const definition = body.definition && typeof body.definition === 'object' ? body.definition : { nodes: [] };
  const [workflow] = await db.insert(workflows).values({ tenantId: result.tenant.id, projectId: result.project.id, name: body.name, slug: body.slug, description: body.description, triggerType: body.triggerType ?? 'manual', webhookSecret: body.webhookSecret, definition, status: body.status ?? 'draft' }).returning();
  return Response.json(workflow, { status: 201 });
}

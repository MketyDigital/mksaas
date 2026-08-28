import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/shared/db';
import { projects, tenantMemberships, tenants, workflowRuns, workflows } from '@/shared/db/schema';
import { auth } from '@/shared/lib/auth';

export async function GET(req: Request, { params }: { params: Promise<{ workflowId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return new Response('Unauthorized', { status: 401 });
  const { workflowId } = await params;
  const url = new URL(req.url);
  const tenantSlug = url.searchParams.get('tenantSlug');
  const projectSlug = url.searchParams.get('projectSlug');
  if (!tenantSlug || !projectSlug) return new Response('tenantSlug and projectSlug are required.', { status: 400 });
  const tenant = await db.query.tenants.findFirst({ where: eq(tenants.slug, tenantSlug) });
  if (!tenant) return new Response('Not found.', { status: 404 });
  const membership = await db.query.tenantMemberships.findFirst({ where: and(eq(tenantMemberships.tenantId, tenant.id), eq(tenantMemberships.userId, session.user.id)) });
  if (!membership) return new Response('Forbidden.', { status: 403 });
  const project = await db.query.projects.findFirst({ where: and(eq(projects.tenantId, tenant.id), eq(projects.slug, projectSlug)) });
  if (!project) return new Response('Not found.', { status: 404 });
  const workflow = await db.query.workflows.findFirst({ where: and(eq(workflows.id, workflowId), eq(workflows.tenantId, tenant.id), eq(workflows.projectId, project.id)) });
  if (!workflow) return new Response('Not found.', { status: 404 });
  const runs = await db.query.workflowRuns.findMany({ where: and(eq(workflowRuns.workflowId, workflow.id), eq(workflowRuns.tenantId, tenant.id), eq(workflowRuns.projectId, project.id)), orderBy: [desc(workflowRuns.startedAt)] });
  return Response.json(runs);
}

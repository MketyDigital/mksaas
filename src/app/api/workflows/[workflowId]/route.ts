import { and, eq } from 'drizzle-orm';
import { db } from '@/shared/db';
import { projects, tenantMemberships, tenants, workflows } from '@/shared/db/schema';
import { auth } from '@/shared/lib/auth';

async function getOwnedWorkflow(req: Request, workflowId: string) {
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
  const workflow = await db.query.workflows.findFirst({ where: and(eq(workflows.id, workflowId), eq(workflows.tenantId, tenant.id), eq(workflows.projectId, project.id)) });
  if (!workflow) return { error: new Response('Workflow not found.', { status: 404 }) };
  return { workflow };
}

export async function GET(req: Request, { params }: { params: Promise<{ workflowId: string }> }) {
  const { workflowId } = await params;
  const result = await getOwnedWorkflow(req, workflowId);
  if ('error' in result) return result.error;
  return Response.json(result.workflow);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ workflowId: string }> }) {
  const { workflowId } = await params;
  const result = await getOwnedWorkflow(req, workflowId);
  if ('error' in result) return result.error;
  const body = (await req.json()) as { name?: string; description?: string; status?: string; triggerType?: string; definition?: unknown; webhookSecret?: string };
  const [updated] = await db.update(workflows).set({ name: body.name ?? result.workflow.name, description: body.description ?? result.workflow.description, status: body.status ?? result.workflow.status, triggerType: body.triggerType ?? result.workflow.triggerType, definition: body.definition && typeof body.definition === 'object' ? body.definition : result.workflow.definition, webhookSecret: body.webhookSecret ?? result.workflow.webhookSecret, version: String(Number(result.workflow.version) + 1), updatedAt: new Date() }).where(eq(workflows.id, workflowId)).returning();
  return Response.json(updated);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ workflowId: string }> }) {
  const { workflowId } = await params;
  const result = await getOwnedWorkflow(req, workflowId);
  if ('error' in result) return result.error;
  await db.delete(workflows).where(eq(workflows.id, workflowId));
  return new Response(null, { status: 204 });
}

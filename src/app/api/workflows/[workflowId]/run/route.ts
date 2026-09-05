import { and, eq } from 'drizzle-orm';

import { executeWorkflow } from '@/features/automation/lib/workflow-runtime';
import { db } from '@/shared/db';
import { projects, tenantMemberships, tenants } from '@/shared/db/schema';
import { auth } from '@/shared/lib/auth';

export async function POST(req: Request, { params }: { params: Promise<{ workflowId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return new Response('Unauthorized', { status: 401 });
  const { workflowId } = await params;
  const body = (await req.json().catch(() => ({}))) as { tenantSlug?: string; projectSlug?: string; input?: Record<string, unknown> };
  if (!body.tenantSlug || !body.projectSlug) return new Response('tenantSlug and projectSlug are required.', { status: 400 });

  const tenant = await db.query.tenants.findFirst({ where: eq(tenants.slug, body.tenantSlug) });
  if (!tenant) return new Response('Workspace not found.', { status: 404 });
  const membership = await db.query.tenantMemberships.findFirst({ where: and(eq(tenantMemberships.tenantId, tenant.id), eq(tenantMemberships.userId, session.user.id)) });
  if (!membership) return new Response('Forbidden.', { status: 403 });
  const project = await db.query.projects.findFirst({ where: and(eq(projects.tenantId, tenant.id), eq(projects.slug, body.projectSlug)) });
  if (!project) return new Response('Project not found.', { status: 404 });

  try {
    const result = await executeWorkflow({ tenantId: tenant.id, projectId: project.id, workflowId, input: body.input ?? {}, triggerType: 'manual' });
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Workflow execution failed.' }, { status: 400 });
  }
}

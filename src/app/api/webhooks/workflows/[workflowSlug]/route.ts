import { and, eq } from 'drizzle-orm';
import { db } from '@/shared/db';
import { projects, tenants, workflows } from '@/shared/db/schema';
import { executeWorkflow } from '@/features/automation/lib/workflow-runtime';

export async function POST(req: Request, { params }: { params: Promise<{ workflowSlug: string }> }) {
  const { workflowSlug } = await params;
  const url = new URL(req.url);
  const tenantSlug = url.searchParams.get('tenantSlug');
  const projectSlug = url.searchParams.get('projectSlug');
  if (!tenantSlug || !projectSlug) return new Response('tenantSlug and projectSlug are required.', { status: 400 });

  const tenant = await db.query.tenants.findFirst({ where: eq(tenants.slug, tenantSlug) });
  if (!tenant) return new Response('Not found.', { status: 404 });
  const project = await db.query.projects.findFirst({ where: and(eq(projects.tenantId, tenant.id), eq(projects.slug, projectSlug)) });
  if (!project) return new Response('Not found.', { status: 404 });
  const workflow = await db.query.workflows.findFirst({ where: and(eq(workflows.tenantId, tenant.id), eq(workflows.projectId, project.id), eq(workflows.slug, workflowSlug)) });
  if (!workflow || workflow.triggerType !== 'webhook') return new Response('Not found.', { status: 404 });

  const configuredSecret = workflow.webhookSecret;
  if (configuredSecret && req.headers.get('x-webhook-secret') !== configuredSecret) return new Response('Unauthorized.', { status: 401 });

  const payload = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    const result = await executeWorkflow({ tenantId: tenant.id, projectId: project.id, workflowId: workflow.id, input: payload, triggerType: 'webhook' });
    return Response.json(result, { status: 202 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Workflow execution failed.' }, { status: 400 });
  }
}

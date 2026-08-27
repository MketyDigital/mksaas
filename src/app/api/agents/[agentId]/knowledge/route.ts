import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/shared/db';
import { agentKnowledge, agents, knowledgeDocuments, projects, tenantMemberships, tenants } from '@/shared/db/schema';
import { auth } from '@/shared/lib/auth';

export async function GET(req: Request, { params }: { params: Promise<{ agentId: string }> }) {
  const context = await authorize(req, params);
  if (context instanceof Response) return context;
  const rows = await db.select({ id: knowledgeDocuments.id, name: knowledgeDocuments.name, status: knowledgeDocuments.status, assigned: eq(agentKnowledge.documentId, knowledgeDocuments.id) }).from(knowledgeDocuments).leftJoin(agentKnowledge, and(eq(agentKnowledge.documentId, knowledgeDocuments.id), eq(agentKnowledge.agentId, context.agent.id))).where(and(eq(knowledgeDocuments.tenantId, context.tenant.id), eq(knowledgeDocuments.projectId, context.project.id)));
  return NextResponse.json({ documents: rows });
}

export async function PUT(req: Request, { params }: { params: Promise<{ agentId: string }> }) {
  const context = await authorize(req, params);
  if (context instanceof Response) return context;
  if (!['admin', 'manager'].includes(context.membership.role)) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  const body = await req.json().catch(() => null) as { documentIds?: string[] } | null;
  const documentIds = [...new Set((body?.documentIds || []).filter((id): id is string => typeof id === 'string'))];
  const documents = documentIds.length ? await db.query.knowledgeDocuments.findMany({ where: and(eq(knowledgeDocuments.tenantId, context.tenant.id), eq(knowledgeDocuments.projectId, context.project.id)) }) : [];
  const allowed = new Set(documents.map((doc) => doc.id));
  if (documentIds.some((id) => !allowed.has(id))) return NextResponse.json({ error: 'Invalid knowledge document.' }, { status: 400 });
  await db.transaction(async (tx) => {
    await tx.delete(agentKnowledge).where(and(eq(agentKnowledge.tenantId, context.tenant.id), eq(agentKnowledge.projectId, context.project.id), eq(agentKnowledge.agentId, context.agent.id)));
    if (documentIds.length) await tx.insert(agentKnowledge).values(documentIds.map((documentId) => ({ tenantId: context.tenant.id, projectId: context.project.id, agentId: context.agent.id, documentId })));
  });
  return NextResponse.json({ ok: true, documentIds });
}

async function authorize(req: Request, params: Promise<{ agentId: string }>) {
  const session = await auth();
  if (!session?.user?.id) return new Response('Unauthorized', { status: 401 });
  const url = new URL(req.url); const tenantSlug = url.searchParams.get('tenantSlug'); const projectSlug = url.searchParams.get('projectSlug'); const { agentId } = await params;
  if (!tenantSlug || !projectSlug) return new Response('tenantSlug and projectSlug are required.', { status: 400 });
  const tenant = await db.query.tenants.findFirst({ where: eq(tenants.slug, tenantSlug) }); if (!tenant) return new Response('Workspace not found.', { status: 404 });
  const membership = await db.query.tenantMemberships.findFirst({ where: and(eq(tenantMemberships.tenantId, tenant.id), eq(tenantMemberships.userId, session.user.id)) }); if (!membership) return new Response('Forbidden.', { status: 403 });
  const project = await db.query.projects.findFirst({ where: and(eq(projects.tenantId, tenant.id), eq(projects.slug, projectSlug)) }); if (!project) return new Response('Project not found.', { status: 404 });
  const agent = await db.query.agents.findFirst({ where: and(eq(agents.id, agentId), eq(agents.tenantId, tenant.id), eq(agents.projectId, project.id)) }); if (!agent) return new Response('Agent not found.', { status: 404 });
  return { tenant, membership, project, agent };
}

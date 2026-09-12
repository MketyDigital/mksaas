import { and, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { publishAgentVersion, snapshotAgentVersion } from '@/features/ai/lib/agent-versioning';
import { db } from '@/shared/db';
import { agents, agentVersions, projects, tenantMemberships, tenants } from '@/shared/db/schema';
import { auth } from '@/shared/lib/auth';

async function getContext(req: Request, agentId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: 'Unauthorized', status: 401 } as const;
  const url = new URL(req.url); const tenantSlug = url.searchParams.get('tenantSlug'); const projectSlug = url.searchParams.get('projectSlug');
  if (!tenantSlug || !projectSlug) return { error: 'tenantSlug and projectSlug are required.', status: 400 } as const;
  const tenant = await db.query.tenants.findFirst({ where: eq(tenants.slug, tenantSlug) });
  if (!tenant) return { error: 'Workspace not found.', status: 404 } as const;
  const membership = await db.query.tenantMemberships.findFirst({ where: and(eq(tenantMemberships.tenantId, tenant.id), eq(tenantMemberships.userId, session.user.id)) });
  if (!membership) return { error: 'Forbidden.', status: 403 } as const;
  const project = await db.query.projects.findFirst({ where: and(eq(projects.tenantId, tenant.id), eq(projects.slug, projectSlug)) });
  const agent = project ? await db.query.agents.findFirst({ where: and(eq(agents.id, agentId), eq(agents.tenantId, tenant.id), eq(agents.projectId, project.id)) }) : null;
  if (!project || !agent) return { error: 'Agent not found.', status: 404 } as const;
  return { tenant, project, agent, membership } as const;
}

export async function GET(req: Request, { params }: { params: Promise<{ agentId: string }> }) {
  const result = await getContext(req, (await params).agentId);
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const versions = await db.query.agentVersions.findMany({ where: and(eq(agentVersions.tenantId, result.tenant.id), eq(agentVersions.projectId, result.project.id), eq(agentVersions.agentId, result.agent.id)), orderBy: [desc(agentVersions.version)] });
  return NextResponse.json({ versions });
}

export async function POST(req: Request, { params }: { params: Promise<{ agentId: string }> }) {
  const result = await getContext(req, (await params).agentId);
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });
  if (!['admin', 'manager'].includes(result.membership.role)) return NextResponse.json({ error: 'Only workspace admins and managers can publish agents.' }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  if (body.action === 'publish') {
    if (!body.versionId) return NextResponse.json({ error: 'versionId is required.' }, { status: 400 });
    const version = await publishAgentVersion(result.tenant.id, result.project.id, result.agent.id, String(body.versionId));
    return NextResponse.json({ published: true, version });
  }
  const version = await snapshotAgentVersion({ tenantId: result.tenant.id, projectId: result.project.id, agent: result.agent });
  return NextResponse.json({ version }, { status: 201 });
}

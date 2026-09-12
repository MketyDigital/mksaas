import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { publishAgentVersion } from '@/features/ai/lib/agent-versioning';
import { db } from '@/shared/db';
import { agents, agentVersions, projects, tenantMemberships, tenants } from '@/shared/db/schema';
import { auth } from '@/shared/lib/auth';

export async function POST(req: Request, { params }: { params: Promise<{ agentId: string }> }) {
  const session = await auth(); if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { agentId } = await params; const body = await req.json().catch(() => ({})); const versionId = String(body.versionId || '');
  const url = new URL(req.url); const tenantSlug = url.searchParams.get('tenantSlug'); const projectSlug = url.searchParams.get('projectSlug');
  if (!tenantSlug || !projectSlug || !versionId) return NextResponse.json({ error: 'tenantSlug, projectSlug and versionId are required.' }, { status: 400 });
  const tenant = await db.query.tenants.findFirst({ where: eq(tenants.slug, tenantSlug) }); if (!tenant) return NextResponse.json({ error: 'Workspace not found.' }, { status: 404 });
  const member = await db.query.tenantMemberships.findFirst({ where: and(eq(tenantMemberships.tenantId, tenant.id), eq(tenantMemberships.userId, session.user.id)) });
  if (!member || !['admin', 'manager'].includes(member.role)) return NextResponse.json({ error: 'Manager permission required.' }, { status: 403 });
  const project = await db.query.projects.findFirst({ where: and(eq(projects.tenantId, tenant.id), eq(projects.slug, projectSlug)) });
  const agent = project ? await db.query.agents.findFirst({ where: and(eq(agents.id, agentId), eq(agents.tenantId, tenant.id), eq(agents.projectId, project.id)) }) : null;
  if (!project || !agent) return NextResponse.json({ error: 'Agent not found.' }, { status: 404 });
  const version = await db.query.agentVersions.findFirst({ where: and(eq(agentVersions.id, versionId), eq(agentVersions.tenantId, tenant.id), eq(agentVersions.projectId, project.id), eq(agentVersions.agentId, agent.id)) });
  if (!version) return NextResponse.json({ error: 'Version not found.' }, { status: 404 });
  const publishedVersion = await publishAgentVersion(tenant.id, project.id, agent.id, version.id);
  return NextResponse.json({ published: true, version: publishedVersion });
}

import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { listAgentTools } from '@/features/ai/lib/tool-registry';
import { db } from '@/shared/db';
import { agents, projects, tenantMemberships, tenants } from '@/shared/db/schema';
import { auth } from '@/shared/lib/auth';

export async function GET(req: Request, { params }: { params: Promise<{ agentId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const url = new URL(req.url);
  const tenantSlug = url.searchParams.get('tenantSlug');
  const projectSlug = url.searchParams.get('projectSlug');
  const { agentId } = await params;
  if (!tenantSlug || !projectSlug) return NextResponse.json({ error: 'tenantSlug and projectSlug are required.' }, { status: 400 });
  const tenant = await db.query.tenants.findFirst({ where: eq(tenants.slug, tenantSlug) });
  if (!tenant) return NextResponse.json({ error: 'Workspace not found.' }, { status: 404 });
  const membership = await db.query.tenantMemberships.findFirst({ where: and(eq(tenantMemberships.tenantId, tenant.id), eq(tenantMemberships.userId, session.user.id)) });
  if (!membership) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  const project = await db.query.projects.findFirst({ where: and(eq(projects.tenantId, tenant.id), eq(projects.slug, projectSlug)) });
  const agent = project ? await db.query.agents.findFirst({ where: and(eq(agents.id, agentId), eq(agents.tenantId, tenant.id), eq(agents.projectId, project.id)) }) : null;
  if (!project || !agent) return NextResponse.json({ error: 'Agent not found.' }, { status: 404 });
  return NextResponse.json({ tools: listAgentTools() });
}

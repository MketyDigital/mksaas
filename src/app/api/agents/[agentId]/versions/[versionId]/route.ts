import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/shared/db';
import { agentVersions, projects, tenantMemberships, tenants } from '@/shared/db/schema';
import { auth } from '@/shared/lib/auth';

export async function GET(req: Request, { params }: { params: Promise<{ agentId: string; versionId: string }> }) {
  const session = await auth(); if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { agentId, versionId } = await params; const url = new URL(req.url); const tenantSlug = url.searchParams.get('tenantSlug'); const projectSlug = url.searchParams.get('projectSlug');
  if (!tenantSlug || !projectSlug) return NextResponse.json({ error: 'tenantSlug and projectSlug are required.' }, { status: 400 });
  const tenant = await db.query.tenants.findFirst({ where: eq(tenants.slug, tenantSlug) });
  if (!tenant) return NextResponse.json({ error: 'Workspace not found.' }, { status: 404 });
  const member = await db.query.tenantMemberships.findFirst({ where: and(eq(tenantMemberships.tenantId, tenant.id), eq(tenantMemberships.userId, session.user.id)) });
  if (!member) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  const project = await db.query.projects.findFirst({ where: and(eq(projects.tenantId, tenant.id), eq(projects.slug, projectSlug)) });
  const version = project ? await db.query.agentVersions.findFirst({ where: and(eq(agentVersions.id, versionId), eq(agentVersions.agentId, agentId), eq(agentVersions.tenantId, tenant.id), eq(agentVersions.projectId, project.id)) }) : null;
  if (!version) return NextResponse.json({ error: 'Version not found.' }, { status: 404 });
  return NextResponse.json({ version });
}

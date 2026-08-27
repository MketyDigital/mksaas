import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/shared/db';
import { agentVersions } from '@/shared/db/schema';

export async function getPublishedAgentVersion(tenantId: string, projectId: string, agentId: string) {
  return db.query.agentVersions.findFirst({
    where: and(eq(agentVersions.tenantId, tenantId), eq(agentVersions.projectId, projectId), eq(agentVersions.agentId, agentId), eq(agentVersions.status, 'published')),
    orderBy: [desc(agentVersions.version)],
  });
}

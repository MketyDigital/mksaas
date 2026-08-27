import { and, eq, max } from 'drizzle-orm';
import { db } from '@/shared/db';
import { agentKnowledge, agentVersions } from '@/shared/db/schema';

export async function snapshotAgentVersion({ tenantId, projectId, agent }: { tenantId: string; projectId: string; agent: { id: string; name: string; instructions: string | null; provider: string; model: string | null; config: string | null } }) {
  const assigned = await db.select({ documentId: agentKnowledge.documentId }).from(agentKnowledge).where(and(eq(agentKnowledge.tenantId, tenantId), eq(agentKnowledge.projectId, projectId), eq(agentKnowledge.agentId, agent.id)));
  const [{ value }] = await db.select({ value: max(agentVersions.version) }).from(agentVersions).where(and(eq(agentVersions.tenantId, tenantId), eq(agentVersions.projectId, projectId), eq(agentVersions.agentId, agent.id)));
  const version = (Number(value) || 0) + 1;
  const [created] = await db.insert(agentVersions).values({ tenantId, projectId, agentId: agent.id, version, status: 'draft', name: agent.name, instructions: agent.instructions, provider: agent.provider, model: agent.model, config: agent.config, knowledgeDocumentIds: assigned.map((row) => row.documentId) }).returning();
  return created;
}

export async function publishAgentVersion(tenantId: string, projectId: string, agentId: string, versionId: string) {
  const target = await db.query.agentVersions.findFirst({ where: and(eq(agentVersions.id, versionId), eq(agentVersions.tenantId, tenantId), eq(agentVersions.projectId, projectId), eq(agentVersions.agentId, agentId)) });
  if (!target) throw new Error('Agent version not found.');
  await db.transaction(async (tx) => {
    await tx.update(agentVersions).set({ status: 'archived' }).where(and(eq(agentVersions.tenantId, tenantId), eq(agentVersions.projectId, projectId), eq(agentVersions.agentId, agentId), eq(agentVersions.status, 'published')));
    await tx.update(agentVersions).set({ status: 'published', publishedAt: new Date() }).where(eq(agentVersions.id, versionId));
  });
  return target.version;
}

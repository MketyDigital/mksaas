import { and, asc, desc, eq } from 'drizzle-orm';

import { ENTERPRISE_AI_SOLUTIONS } from '@/features/ai-runtime/business-solutions';
import { db } from '@/shared/db/cloudflare';
import { aiSolutionInstances, aiSolutionTemplates, projects } from '@/shared/db/schema/ai-runtime';

export async function listEnterpriseAiSolutionTemplates() {
  const rows = await db.select().from(aiSolutionTemplates)
    .where(eq(aiSolutionTemplates.enabled, true))
    .orderBy(asc(aiSolutionTemplates.sortOrder));

  if (rows.length) return rows;
  return ENTERPRISE_AI_SOLUTIONS.map((item, index) => ({
    key: item.key,
    title: item.title,
    shortDescription: item.shortDescription,
    outcomes: item.outcomes,
    setupSteps: item.setupSteps,
    enabled: true,
    sortOrder: (index + 1) * 10,
    updatedByUserId: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  }));
}

export async function getEnterpriseAiSolutionTemplate(key: string) {
  const row = await db.query.aiSolutionTemplates.findFirst({
    where: and(eq(aiSolutionTemplates.key, key), eq(aiSolutionTemplates.enabled, true)),
  });
  if (row) return row;
  const fallback = ENTERPRISE_AI_SOLUTIONS.find((item) => item.key === key);
  if (!fallback) return null;
  return {
    key: fallback.key,
    title: fallback.title,
    shortDescription: fallback.shortDescription,
    outcomes: fallback.outcomes,
    setupSteps: fallback.setupSteps,
    enabled: true,
    sortOrder: 100,
    updatedByUserId: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  };
}

export async function listEnterpriseAiSolutionInstances(tenantId: string) {
  return db.select().from(aiSolutionInstances)
    .where(eq(aiSolutionInstances.tenantId, tenantId))
    .orderBy(desc(aiSolutionInstances.updatedAt));
}

export async function listTenantProjectChoices(tenantId: string) {
  return db.select({ id: projects.id, name: projects.name, slug: projects.slug })
    .from(projects)
    .where(eq(projects.tenantId, tenantId))
    .orderBy(asc(projects.name));
}

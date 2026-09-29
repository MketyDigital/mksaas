import { and, asc, desc, eq } from 'drizzle-orm';

import { ENTERPRISE_AI_SOLUTIONS } from '@/features/ai-runtime/business-solutions';
import { db } from '@/shared/db/cloudflare';
import { projects } from '@/shared/db/schema';
import { aiSolutionInstances, aiSolutionTemplates } from '@/shared/db/schema/ai-runtime';


export type EnterpriseAiSolutionConfiguration = {
  systemPrompt: string;
  knowledgeText: string;
  defaultModelAlias: string;
  paused: boolean;
  replyDelayMode: 'off' | 'fixed' | 'range';
  replyDelayMinSeconds: number;
  replyDelayMaxSeconds: number;
  commitmentRemindersEnabled: boolean;
  reminderTimezone: string;
  reminderLeadMinutes: number;
};

export function parseEnterpriseAiSolutionConfiguration(value: Record<string, unknown> | null | undefined): EnterpriseAiSolutionConfiguration {
  const source = value ?? {};
  return {
    systemPrompt: typeof source.systemPrompt === 'string' ? source.systemPrompt : '',
    knowledgeText: typeof source.knowledgeText === 'string' ? source.knowledgeText : '',
    defaultModelAlias:
      typeof source.defaultModelAlias === 'string' && source.defaultModelAlias.trim()
        ? source.defaultModelAlias.trim()
        : 'mkety-economy',
    paused: source.paused === true,
    replyDelayMode:
      source.replyDelayMode === 'fixed' || source.replyDelayMode === 'range'
        ? source.replyDelayMode
        : 'off',
    replyDelayMinSeconds:
      typeof source.replyDelayMinSeconds === 'number' && Number.isFinite(source.replyDelayMinSeconds)
        ? Math.max(0, Math.min(900, Math.trunc(source.replyDelayMinSeconds)))
        : 0,
    replyDelayMaxSeconds:
      typeof source.replyDelayMaxSeconds === 'number' && Number.isFinite(source.replyDelayMaxSeconds)
        ? Math.max(0, Math.min(900, Math.trunc(source.replyDelayMaxSeconds)))
        : 0,
    commitmentRemindersEnabled: source.commitmentRemindersEnabled === true,
    reminderTimezone:
      typeof source.reminderTimezone === 'string' && source.reminderTimezone.trim()
        ? source.reminderTimezone.trim().slice(0, 80)
        : 'UTC',
    reminderLeadMinutes:
      typeof source.reminderLeadMinutes === 'number' && Number.isFinite(source.reminderLeadMinutes)
        ? Math.max(0, Math.min(10_080, Math.trunc(source.reminderLeadMinutes)))
        : 0,
  };
}

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

export async function getEnterpriseAiSolutionInstance(tenantId: string, id: string) {
  return db.query.aiSolutionInstances.findFirst({
    where: and(eq(aiSolutionInstances.tenantId, tenantId), eq(aiSolutionInstances.id, id)),
  });
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

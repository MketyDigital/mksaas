'use server';

import { and, eq, inArray, isNull } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { appExperienceDefaultsSchema } from '@/features/platform-app-experience/schemas';
import { db } from '@/shared/db';
import * as schema from '@/shared/db/schema';
import type { PlatformJson } from '@/shared/db/schema/platform-content';

import {
  docsArticleSchema,
  docsCategorySchema,
  heroSectionSchema,
  navigationItemSchema,
  pricingPlanSchema,
  siteSettingsSchema,
} from '../schemas';
import { recordPlatformContentAuditEvent } from './audit';
import { requirePlatformAppExperienceAccess, requirePlatformContentAccess } from './authorization';

export const platformContentAreaSchema = z.enum(['public-site', 'docs', 'pricing', 'navigation', 'settings', 'app-experience']);
export const platformContentEntitySchema = z.enum([
  'site_settings',
  'page',
  'page_section',
  'navigation_item',
  'pricing_plan',
  'pricing_feature',
  'docs_category',
  'docs_article',
  'app_experience',
]);

export const platformContentDraftActionSchema = z.object({
  area: platformContentAreaSchema,
  entityType: platformContentEntitySchema,
  entityKey: z.string().min(1).max(180),
  payload: z.record(z.string(), z.unknown()),
});

export const platformPublishActionSchema = z.object({
  area: platformContentAreaSchema,
  entityType: platformContentEntitySchema,
  entityKey: z.string().min(1).max(180),
});

export type PlatformContentDraftActionInput = z.infer<typeof platformContentDraftActionSchema>;
export type PlatformPublishActionInput = z.infer<typeof platformPublishActionSchema>;

type Area = z.infer<typeof platformContentAreaSchema>;
type EntityType = z.infer<typeof platformContentEntitySchema>;
type ContentEntityType = Exclude<EntityType, 'app_experience'>;
type MutationDb = Pick<typeof db, 'insert'>;

type ActionResult = {
  ok: true;
  status: 'draft_saved' | 'published';
  actorEmail: string;
  area: Area;
  entityType: EntityType;
  entityKey: string;
  mutatedRecords: number;
  auditRecorded: boolean;
};

const navigationPayloadSchema = z.object({ items: z.array(navigationItemSchema).min(1) });
const pricingPayloadSchema = z.object({ plans: z.array(pricingPlanSchema).min(1) });
const docsPayloadSchema = z.object({ categories: z.array(docsCategorySchema).min(1), articles: z.array(docsArticleSchema).min(1) });

async function requireAreaAccess(tenantSlug: string, area: Area) {
  return area === 'app-experience' ? requirePlatformAppExperienceAccess(tenantSlug) : requirePlatformContentAccess(tenantSlug);
}

function revalidatePlatformContentPaths(tenantSlug: string) {
  revalidatePath('/');
  revalidatePath('/docs');
  revalidatePath(`/t/${tenantSlug}/admin/platform-control`);
  revalidatePath(`/t/${tenantSlug}/admin/platform-control/public-site`);
}

function toPlatformJson(value: unknown): PlatformJson | null {
  if (value === undefined) return null;
  return JSON.parse(JSON.stringify(value)) as PlatformJson;
}

function normalizeHomeSectionKey(entityKey: string) {
  return entityKey.startsWith('home.') ? entityKey : `home.${entityKey}`;
}

function legacyHomeSectionKey(entityKey: string) {
  return entityKey.startsWith('home.') ? entityKey.slice('home.'.length) : entityKey;
}

async function insertContentRevision(
  tx: MutationDb,
  input: {
    entityType: ContentEntityType;
    entityId: string;
    action: 'create' | 'update' | 'publish';
    beforeJson?: unknown;
    afterJson?: unknown;
    actorId: string;
  },
) {
  await tx.insert(schema.platformContentRevisions).values({
    entityType: input.entityType,
    entityId: input.entityId,
    action: input.action,
    beforeJson: toPlatformJson(input.beforeJson),
    afterJson: toPlatformJson(input.afterJson),
    actorId: input.actorId,
  });
}

async function insertAppExperienceRevision(
  tx: MutationDb,
  input: {
    entityType: 'dashboard_settings' | 'workspace_card' | 'control_center_module';
    entityId: string;
    beforeJson?: unknown;
    afterJson?: unknown;
    actorId: string;
  },
) {
  await tx.insert(schema.platformAppExperienceRevisions).values({
    entityType: input.entityType,
    entityId: input.entityId,
    beforeJson: toPlatformJson(input.beforeJson) as Record<string, unknown> | null,
    afterJson: toPlatformJson(input.afterJson) as Record<string, unknown> | null,
    actorId: input.actorId,
  });
}

async function saveSiteSettingsDraft(payload: unknown, actorId: string) {
  const settings = siteSettingsSchema.parse(payload);

  return db.transaction(async (tx) => {
    const existing = await tx.query.platformSiteSettings.findFirst({ where: eq(schema.platformSiteSettings.environment, 'production') });
    const values = {
      environment: 'production',
      status: 'draft' as const,
      brandName: settings.brandName,
      logoUrl: settings.logoUrl ?? null,
      faviconUrl: settings.faviconUrl ?? null,
      primaryColor: settings.primaryColor,
      secondaryColor: settings.secondaryColor,
      accentColor: settings.accentColor,
      defaultSeoTitle: settings.defaultSeoTitle,
      defaultSeoDescription: settings.defaultSeoDescription,
      socialImageUrl: settings.socialImageUrl ?? null,
      contactEmail: settings.contactEmail ?? null,
      contactHref: settings.contactHref ?? null,
      legalLinksJson: settings.legalLinks,
      updatedBy: actorId,
      updatedAt: new Date(),
    };

    const [row] = existing
      ? await tx.update(schema.platformSiteSettings).set(values).where(eq(schema.platformSiteSettings.id, existing.id)).returning()
      : await tx.insert(schema.platformSiteSettings).values({ ...values, createdBy: actorId }).returning();

    await insertContentRevision(tx, { entityType: 'site_settings', entityId: row.id, action: existing ? 'update' : 'create', beforeJson: existing, afterJson: row, actorId });
    return 1;
  });
}

async function saveHomeSectionDraft(entityKey: string, payload: unknown, actorId: string) {
  const sectionKey = normalizeHomeSectionKey(entityKey);
  const sectionType = legacyHomeSectionKey(sectionKey);
  const sectionPayload = sectionKey === 'home.hero' ? heroSectionSchema.parse(payload) : z.unknown().parse(payload);

  return db.transaction(async (tx) => {
    const existingPage = await tx.query.platformPages.findFirst({ where: eq(schema.platformPages.slug, 'home') });
    const [page] = existingPage
      ? await tx.update(schema.platformPages).set({ status: 'draft', enabled: true, updatedBy: actorId, updatedAt: new Date() }).where(eq(schema.platformPages.id, existingPage.id)).returning()
      : await tx.insert(schema.platformPages).values({ slug: 'home', title: 'Mkety Home', status: 'draft', enabled: true, createdBy: actorId, updatedBy: actorId }).returning();

    const existingSection = await tx.query.platformPageSections.findFirst({
      where: and(eq(schema.platformPageSections.pageId, page.id), inArray(schema.platformPageSections.sectionKey, [sectionKey, sectionType])),
    });
    const sectionValues = {
      pageId: page.id,
      sectionKey,
      sectionType,
      sortOrder: sectionKey === 'home.hero' ? 10 : 100,
      enabled: true,
      status: 'draft' as const,
      contentJson: toPlatformJson(sectionPayload) ?? {},
      updatedBy: actorId,
      updatedAt: new Date(),
    };
    const [section] = existingSection
      ? await tx.update(schema.platformPageSections).set(sectionValues).where(eq(schema.platformPageSections.id, existingSection.id)).returning()
      : await tx.insert(schema.platformPageSections).values({ ...sectionValues, createdBy: actorId }).returning();

    await insertContentRevision(tx, { entityType: 'page_section', entityId: section.id, action: existingSection ? 'update' : 'create', beforeJson: existingSection, afterJson: section, actorId });
    return 1;
  });
}

async function saveNavigationDraft(payload: unknown, actorId: string) {
  const parsed = navigationPayloadSchema.parse(payload);

  return db.transaction(async (tx) => {
    let mutatedRecords = 0;
    const areas = [...new Set(parsed.items.map((item) => item.area))];
    for (const area of areas) {
      await tx.delete(schema.platformNavigationItems).where(and(eq(schema.platformNavigationItems.area, area), eq(schema.platformNavigationItems.status, 'draft')));
    }

    for (const item of parsed.items) {
      const [row] = await tx
        .insert(schema.platformNavigationItems)
        .values({ area: item.area, label: item.label, href: item.href, sortOrder: item.sortOrder, enabled: item.enabled, external: item.external, status: 'draft', createdBy: actorId, updatedBy: actorId })
        .returning();
      await insertContentRevision(tx, { entityType: 'navigation_item', entityId: row.id, action: 'create', afterJson: row, actorId });
      mutatedRecords += 1;
    }
    return mutatedRecords;
  });
}

async function savePricingDraft(payload: unknown, actorId: string) {
  const parsed = pricingPayloadSchema.parse(payload);

  return db.transaction(async (tx) => {
    let mutatedRecords = 0;
    for (const plan of parsed.plans) {
      const existing = await tx.query.platformPricingPlans.findFirst({ where: eq(schema.platformPricingPlans.key, plan.key) });
      const planValues = {
        key: plan.key,
        name: plan.name,
        priceLabel: plan.priceLabel,
        billingLabel: plan.billingLabel ?? null,
        description: plan.description,
        highlighted: plan.highlighted,
        ctaLabel: plan.ctaLabel,
        ctaHref: plan.ctaHref,
        sortOrder: mutatedRecords * 10 + 10,
        status: 'draft' as const,
        updatedBy: actorId,
        updatedAt: new Date(),
      };
      const [row] = existing
        ? await tx.update(schema.platformPricingPlans).set(planValues).where(eq(schema.platformPricingPlans.id, existing.id)).returning()
        : await tx.insert(schema.platformPricingPlans).values({ ...planValues, createdBy: actorId }).returning();

      await tx.delete(schema.platformPricingFeatures).where(eq(schema.platformPricingFeatures.planId, row.id));
      if (plan.features.length > 0) {
        await tx.insert(schema.platformPricingFeatures).values(plan.features.map((label, index) => ({ planId: row.id, label, sortOrder: index * 10 + 10, enabled: true })));
      }
      await insertContentRevision(tx, { entityType: 'pricing_plan', entityId: row.id, action: existing ? 'update' : 'create', beforeJson: existing, afterJson: { ...row, features: plan.features }, actorId });
      mutatedRecords += 1;
    }
    return mutatedRecords;
  });
}

async function saveDocsDraft(payload: unknown, actorId: string) {
  const parsed = docsPayloadSchema.parse(payload);

  return db.transaction(async (tx) => {
    let mutatedRecords = 0;
    const categoryIdByKey = new Map<string, string>();
    for (const category of parsed.categories) {
      const existing = await tx.query.platformDocsCategories.findFirst({ where: eq(schema.platformDocsCategories.key, category.key) });
      const categoryValues = { key: category.key, title: category.title, description: category.description ?? null, sortOrder: category.sortOrder, status: 'draft' as const, updatedBy: actorId, updatedAt: new Date() };
      const [row] = existing
        ? await tx.update(schema.platformDocsCategories).set(categoryValues).where(eq(schema.platformDocsCategories.id, existing.id)).returning()
        : await tx.insert(schema.platformDocsCategories).values({ ...categoryValues, createdBy: actorId }).returning();
      categoryIdByKey.set(row.key, row.id);
      await insertContentRevision(tx, { entityType: 'docs_category', entityId: row.id, action: existing ? 'update' : 'create', beforeJson: existing, afterJson: row, actorId });
      mutatedRecords += 1;
    }

    for (const article of parsed.articles) {
      const categoryId = categoryIdByKey.get(article.categoryKey);
      if (!categoryId) continue;
      const existing = await tx.query.platformDocsArticles.findFirst({ where: and(eq(schema.platformDocsArticles.categoryId, categoryId), eq(schema.platformDocsArticles.slug, article.slug)) });
      const articleValues = { categoryId, slug: article.slug, title: article.title, excerpt: article.excerpt ?? null, bodyMarkdown: article.bodyMarkdown, sortOrder: article.sortOrder, status: 'draft' as const, seoTitle: article.seoTitle ?? null, seoDescription: article.seoDescription ?? null, updatedBy: actorId, updatedAt: new Date() };
      const [row] = existing
        ? await tx.update(schema.platformDocsArticles).set(articleValues).where(eq(schema.platformDocsArticles.id, existing.id)).returning()
        : await tx.insert(schema.platformDocsArticles).values({ ...articleValues, createdBy: actorId }).returning();
      await insertContentRevision(tx, { entityType: 'docs_article', entityId: row.id, action: existing ? 'update' : 'create', beforeJson: existing, afterJson: row, actorId });
      mutatedRecords += 1;
    }
    return mutatedRecords;
  });
}

async function saveAppExperienceDraft(payload: unknown, actorId: string) {
  const parsed = appExperienceDefaultsSchema.parse(payload);

  return db.transaction(async (tx) => {
    let mutatedRecords = 0;
    const existingDashboard = await tx.query.platformAppDashboardSettings.findFirst({ where: and(eq(schema.platformAppDashboardSettings.environment, 'production'), isNull(schema.platformAppDashboardSettings.tenantId)) });
    const dashboardValues = {
      environment: 'production',
      tenantId: null,
      status: 'draft' as const,
      headline: parsed.dashboard.headline,
      description: parsed.dashboard.description,
      primaryCtaLabel: parsed.dashboard.primaryCta.label,
      primaryCtaHref: parsed.dashboard.primaryCta.href,
      secondaryCtaLabel: parsed.dashboard.secondaryCta?.label ?? null,
      secondaryCtaHref: parsed.dashboard.secondaryCta?.href ?? null,
      supportLabel: parsed.dashboard.support?.label ?? null,
      supportHref: parsed.dashboard.support?.href ?? null,
      updatedBy: actorId,
      updatedAt: new Date(),
    };
    const [dashboard] = existingDashboard
      ? await tx.update(schema.platformAppDashboardSettings).set(dashboardValues).where(eq(schema.platformAppDashboardSettings.id, existingDashboard.id)).returning()
      : await tx.insert(schema.platformAppDashboardSettings).values({ ...dashboardValues, createdBy: actorId }).returning();
    await insertAppExperienceRevision(tx, { entityType: 'dashboard_settings', entityId: dashboard.id, beforeJson: existingDashboard, afterJson: dashboard, actorId });
    mutatedRecords += 1;

    for (const workspace of parsed.workspaces) {
      const existing = await tx.query.platformWorkspaceCards.findFirst({ where: and(eq(schema.platformWorkspaceCards.workspaceKey, workspace.key), isNull(schema.platformWorkspaceCards.tenantId)) });
      const workspaceValues = { tenantId: null, workspaceKey: workspace.key, label: workspace.label, description: workspace.description, href: workspace.href, iconKey: workspace.iconKey ?? null, badgeLabel: workspace.badgeLabel ?? null, enabled: workspace.enabled, requiresEntitlement: workspace.requiresEntitlement ?? null, sortOrder: workspace.sortOrder, status: 'draft' as const, updatedBy: actorId, updatedAt: new Date() };
      const [row] = existing
        ? await tx.update(schema.platformWorkspaceCards).set(workspaceValues).where(eq(schema.platformWorkspaceCards.id, existing.id)).returning()
        : await tx.insert(schema.platformWorkspaceCards).values({ ...workspaceValues, createdBy: actorId }).returning();
      await insertAppExperienceRevision(tx, { entityType: 'workspace_card', entityId: row.id, beforeJson: existing, afterJson: row, actorId });
      mutatedRecords += 1;
    }

    for (const module of parsed.controlCenterModules) {
      const existing = await tx.query.platformAppControlCenterModules.findFirst({ where: eq(schema.platformAppControlCenterModules.moduleKey, module.key) });
      const moduleValues = {
        moduleKey: module.key,
        label: module.label,
        description: module.description,
        href: module.href,
        iconKey: module.iconKey ?? null,
        level: module.level,
        enabled: module.enabled,
        requiredPermission: module.requiredPermission,
        sortOrder: module.sortOrder,
        status: 'draft' as const,
        metadataJson: { domain: module.domain, status: module.status, editableScope: module.editableScope, protectedScope: module.protectedScope, implementationNotes: module.implementationNotes },
        updatedBy: actorId,
        updatedAt: new Date(),
      };
      const [row] = existing
        ? await tx.update(schema.platformAppControlCenterModules).set(moduleValues).where(eq(schema.platformAppControlCenterModules.id, existing.id)).returning()
        : await tx.insert(schema.platformAppControlCenterModules).values({ ...moduleValues, createdBy: actorId }).returning();
      await insertAppExperienceRevision(tx, { entityType: 'control_center_module', entityId: row.id, beforeJson: existing, afterJson: row, actorId });
      mutatedRecords += 1;
    }
    return mutatedRecords;
  });
}

async function saveDraftRecord(parsed: PlatformContentDraftActionInput, actorId: string) {
  switch (parsed.entityType) {
    case 'site_settings':
      return saveSiteSettingsDraft(parsed.payload, actorId);
    case 'page_section':
      return saveHomeSectionDraft(parsed.entityKey, parsed.payload, actorId);
    case 'navigation_item':
      return saveNavigationDraft(parsed.payload, actorId);
    case 'pricing_plan':
      return savePricingDraft(parsed.payload, actorId);
    case 'docs_article':
      return saveDocsDraft(parsed.payload, actorId);
    case 'app_experience':
      return saveAppExperienceDraft(parsed.payload, actorId);
    default:
      throw new Error(`Unsupported Mkety content draft entity: ${parsed.entityType}`);
  }
}

async function publishDraftRecord(parsed: PlatformPublishActionInput, actorId: string) {
  const now = new Date();

  return db.transaction(async (tx) => {
    switch (parsed.entityType) {
      case 'site_settings': {
        const rows = await tx.update(schema.platformSiteSettings).set({ status: 'published', publishedAt: now, updatedBy: actorId, updatedAt: now }).where(and(eq(schema.platformSiteSettings.environment, parsed.entityKey), eq(schema.platformSiteSettings.status, 'draft'))).returning();
        for (const row of rows) await insertContentRevision(tx, { entityType: 'site_settings', entityId: row.id, action: 'publish', afterJson: row, actorId });
        return rows.length;
      }
      case 'page_section': {
        const page = await tx.query.platformPages.findFirst({ where: eq(schema.platformPages.slug, 'home') });
        if (!page) return 0;
        const sectionKey = normalizeHomeSectionKey(parsed.entityKey);
        const legacyKey = legacyHomeSectionKey(sectionKey);
        const rows = await tx.update(schema.platformPageSections).set({ status: 'published', publishedAt: now, updatedBy: actorId, updatedAt: now }).where(and(eq(schema.platformPageSections.pageId, page.id), inArray(schema.platformPageSections.sectionKey, [sectionKey, legacyKey]), eq(schema.platformPageSections.status, 'draft'))).returning();
        if (rows.length > 0) {
          await tx.update(schema.platformPages).set({ status: 'published', publishedAt: now, updatedBy: actorId, updatedAt: now }).where(eq(schema.platformPages.id, page.id));
        }
        for (const row of rows) await insertContentRevision(tx, { entityType: 'page_section', entityId: row.id, action: 'publish', afterJson: row, actorId });
        return rows.length;
      }
      case 'navigation_item': {
        const rows = await tx.update(schema.platformNavigationItems).set({ status: 'published', updatedBy: actorId, updatedAt: now }).where(eq(schema.platformNavigationItems.status, 'draft')).returning();
        for (const row of rows) await insertContentRevision(tx, { entityType: 'navigation_item', entityId: row.id, action: 'publish', afterJson: row, actorId });
        return rows.length;
      }
      case 'pricing_plan': {
        const rows = await tx.update(schema.platformPricingPlans).set({ status: 'published', updatedBy: actorId, updatedAt: now }).where(eq(schema.platformPricingPlans.status, 'draft')).returning();
        for (const row of rows) await insertContentRevision(tx, { entityType: 'pricing_plan', entityId: row.id, action: 'publish', afterJson: row, actorId });
        return rows.length;
      }
      case 'docs_article': {
        const categories = await tx.update(schema.platformDocsCategories).set({ status: 'published', updatedBy: actorId, updatedAt: now }).where(eq(schema.platformDocsCategories.status, 'draft')).returning();
        const articles = await tx.update(schema.platformDocsArticles).set({ status: 'published', publishedAt: now, updatedBy: actorId, updatedAt: now }).where(eq(schema.platformDocsArticles.status, 'draft')).returning();
        for (const row of categories) await insertContentRevision(tx, { entityType: 'docs_category', entityId: row.id, action: 'publish', afterJson: row, actorId });
        for (const row of articles) await insertContentRevision(tx, { entityType: 'docs_article', entityId: row.id, action: 'publish', afterJson: row, actorId });
        return categories.length + articles.length;
      }
      case 'app_experience': {
        const dashboard = await tx.update(schema.platformAppDashboardSettings).set({ status: 'published', publishedAt: now, updatedBy: actorId, updatedAt: now }).where(and(eq(schema.platformAppDashboardSettings.status, 'draft'), isNull(schema.platformAppDashboardSettings.tenantId))).returning();
        const workspaces = await tx.update(schema.platformWorkspaceCards).set({ status: 'published', publishedAt: now, updatedBy: actorId, updatedAt: now }).where(and(eq(schema.platformWorkspaceCards.status, 'draft'), isNull(schema.platformWorkspaceCards.tenantId))).returning();
        const modules = await tx.update(schema.platformAppControlCenterModules).set({ status: 'published', publishedAt: now, updatedBy: actorId, updatedAt: now }).where(eq(schema.platformAppControlCenterModules.status, 'draft')).returning();
        for (const row of dashboard) await insertAppExperienceRevision(tx, { entityType: 'dashboard_settings', entityId: row.id, afterJson: row, actorId });
        for (const row of workspaces) await insertAppExperienceRevision(tx, { entityType: 'workspace_card', entityId: row.id, afterJson: row, actorId });
        for (const row of modules) await insertAppExperienceRevision(tx, { entityType: 'control_center_module', entityId: row.id, afterJson: row, actorId });
        return dashboard.length + workspaces.length + modules.length;
      }
      default:
        throw new Error(`Unsupported Mkety publish entity: ${parsed.entityType}`);
    }
  });
}

async function recordAuditSafely(input: {
  tenantSlug: string;
  actorUserId: string;
  actorEmail: string;
  action: 'platform_content.draft_saved' | 'platform_content.published';
  contentInput: PlatformContentDraftActionInput | PlatformPublishActionInput;
  mutatedRecords: number;
}) {
  try {
    await recordPlatformContentAuditEvent({ tenantSlug: input.tenantSlug, actorUserId: input.actorUserId, actorEmail: input.actorEmail, action: input.action, input: input.contentInput, mutatedRecords: input.mutatedRecords });
    return true;
  } catch {
    return false;
  }
}

export async function savePlatformContentDraft(tenantSlug: string, input: PlatformContentDraftActionInput): Promise<ActionResult> {
  const parsed = platformContentDraftActionSchema.parse(input);
  const actor = await requireAreaAccess(tenantSlug, parsed.area);
  const mutatedRecords = await saveDraftRecord(parsed, actor.userId);
  const auditRecorded = await recordAuditSafely({ tenantSlug, actorUserId: actor.userId, actorEmail: actor.email, action: 'platform_content.draft_saved', contentInput: parsed, mutatedRecords });
  revalidatePlatformContentPaths(tenantSlug);
  return { ok: true, status: 'draft_saved', actorEmail: actor.email, area: parsed.area, entityType: parsed.entityType, entityKey: parsed.entityKey, mutatedRecords, auditRecorded };
}

export async function publishPlatformContent(tenantSlug: string, input: PlatformPublishActionInput): Promise<ActionResult> {
  const parsed = platformPublishActionSchema.parse(input);
  const actor = await requireAreaAccess(tenantSlug, parsed.area);
  const mutatedRecords = await publishDraftRecord(parsed, actor.userId);
  const auditRecorded = await recordAuditSafely({ tenantSlug, actorUserId: actor.userId, actorEmail: actor.email, action: 'platform_content.published', contentInput: parsed, mutatedRecords });
  revalidatePlatformContentPaths(tenantSlug);
  return { ok: true, status: 'published', actorEmail: actor.email, area: parsed.area, entityType: parsed.entityType, entityKey: parsed.entityKey, mutatedRecords, auditRecorded };
}

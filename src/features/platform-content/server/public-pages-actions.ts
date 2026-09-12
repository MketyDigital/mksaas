'use server';

import { and, eq, inArray } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

import { MKETY_PUBLIC_PAGE_DEFAULTS } from '@/features/platform-content/public-page-defaults';
import {
  type PublicPagesAdminPayload,
  publicPagesAdminPayloadSchema,
} from '@/features/platform-content/public-pages-admin';
import { db } from '@/shared/db';
import * as schema from '@/shared/db/schema';
import type { PlatformJson } from '@/shared/db/schema/platform-content';

import { recordPlatformContentAuditEvent } from './audit';
import { requirePlatformContentAccess } from './authorization';

const ENTITY_KEY = 'public-pages';
const MANAGED_PUBLIC_PAGE_SLUGS = MKETY_PUBLIC_PAGE_DEFAULTS.map((page) => page.slug);

function toPlatformJson(value: unknown): PlatformJson {
  return JSON.parse(JSON.stringify(value)) as PlatformJson;
}

function revalidatePublicPages(tenantSlug: string, slugs: readonly string[]) {
  for (const slug of slugs) revalidatePath(`/${slug}`);
  revalidatePath('/');
  revalidatePath('/docs');
  revalidatePath(`/t/${tenantSlug}/admin/platform-control/public-site`);
  revalidatePath(`/t/${tenantSlug}/admin/platform-control/public-site/pages`);
}

async function recordAuditSafely(input: {
  tenantSlug: string;
  actorUserId: string;
  actorEmail: string;
  action: 'platform_content.draft_saved' | 'platform_content.published';
  payload?: PublicPagesAdminPayload;
  mutatedRecords: number;
}) {
  try {
    await recordPlatformContentAuditEvent({
      tenantSlug: input.tenantSlug,
      actorUserId: input.actorUserId,
      actorEmail: input.actorEmail,
      action: input.action,
      input: input.payload
        ? { area: 'public-site', entityType: 'page', entityKey: ENTITY_KEY, payload: input.payload }
        : { area: 'public-site', entityType: 'page', entityKey: ENTITY_KEY },
      mutatedRecords: input.mutatedRecords,
    });
    return true;
  } catch {
    return false;
  }
}

export async function savePublicPagesDraft(tenantSlug: string, payload: PublicPagesAdminPayload) {
  const parsed = publicPagesAdminPayloadSchema.parse(payload);
  const actor = await requirePlatformContentAccess(tenantSlug);

  const mutatedRecords = await db.transaction(async (tx) => {
    let count = 0;

    for (const pageInput of parsed.pages) {
      const existingPage = await tx.query.platformPages.findFirst({
        where: eq(schema.platformPages.slug, pageInput.slug),
      });
      const pageValues = {
        slug: pageInput.slug,
        title: pageInput.title,
        seoTitle: pageInput.seoTitle,
        seoDescription: pageInput.seoDescription,
        enabled: true,
        status: 'draft' as const,
        updatedBy: actor.userId,
        updatedAt: new Date(),
      };
      const [page] = existingPage
        ? await tx
            .update(schema.platformPages)
            .set(pageValues)
            .where(eq(schema.platformPages.id, existingPage.id))
            .returning()
        : await tx
            .insert(schema.platformPages)
            .values({ ...pageValues, createdBy: actor.userId })
            .returning();

      await tx.insert(schema.platformContentRevisions).values({
        entityType: 'page',
        entityId: page.id,
        action: existingPage ? 'update' : 'create',
        beforeJson: existingPage ? toPlatformJson(existingPage) : null,
        afterJson: toPlatformJson(page),
        actorId: actor.userId,
      });
      count += 1;

      const sections = [
        {
          sectionKey: 'intro',
          sectionType: 'overview',
          sortOrder: 0,
          content: {
            eyebrow: pageInput.eyebrow,
            title: pageInput.headline,
            description: pageInput.intro,
            items: [],
          },
        },
        ...pageInput.sections.map((section, index) => ({
          sectionKey: `section-${index + 1}`,
          sectionType: 'overview',
          sortOrder: (index + 1) * 10,
          content: section,
        })),
      ];

      const managedSectionKeys = sections.map((section) => section.sectionKey);
      const existingSections = await tx.query.platformPageSections.findMany({
        where: eq(schema.platformPageSections.pageId, page.id),
      });

      for (const sectionInput of sections) {
        const existingSection = existingSections.find((section) => section.sectionKey === sectionInput.sectionKey);
        const sectionValues = {
          pageId: page.id,
          sectionKey: sectionInput.sectionKey,
          sectionType: sectionInput.sectionType,
          sortOrder: sectionInput.sortOrder,
          enabled: true,
          status: 'draft' as const,
          contentJson: toPlatformJson(sectionInput.content),
          updatedBy: actor.userId,
          updatedAt: new Date(),
        };
        const [section] = existingSection
          ? await tx
              .update(schema.platformPageSections)
              .set(sectionValues)
              .where(eq(schema.platformPageSections.id, existingSection.id))
              .returning()
          : await tx
              .insert(schema.platformPageSections)
              .values({ ...sectionValues, createdBy: actor.userId })
              .returning();

        await tx.insert(schema.platformContentRevisions).values({
          entityType: 'page_section',
          entityId: section.id,
          action: existingSection ? 'update' : 'create',
          beforeJson: existingSection ? toPlatformJson(existingSection) : null,
          afterJson: toPlatformJson(section),
          actorId: actor.userId,
        });
        count += 1;
      }

      const staleSections = existingSections.filter((section) => !managedSectionKeys.includes(section.sectionKey));
      for (const staleSection of staleSections) {
        await tx
          .update(schema.platformPageSections)
          .set({ enabled: false, status: 'draft', updatedBy: actor.userId, updatedAt: new Date() })
          .where(eq(schema.platformPageSections.id, staleSection.id));
        count += 1;
      }
    }

    return count;
  });

  const auditRecorded = await recordAuditSafely({
    tenantSlug,
    actorUserId: actor.userId,
    actorEmail: actor.email,
    action: 'platform_content.draft_saved',
    payload: parsed,
    mutatedRecords,
  });
  revalidatePublicPages(
    tenantSlug,
    parsed.pages.map((page) => page.slug),
  );

  return {
    ok: true as const,
    status: 'draft_saved' as const,
    actorEmail: actor.email,
    area: 'public-site' as const,
    entityType: 'page' as const,
    entityKey: ENTITY_KEY,
    mutatedRecords,
    auditRecorded,
  };
}

export async function publishPublicPages(tenantSlug: string) {
  const actor = await requirePlatformContentAccess(tenantSlug);
  const now = new Date();

  const mutatedRecords = await db.transaction(async (tx) => {
    const pages = await tx
      .update(schema.platformPages)
      .set({ status: 'published', publishedAt: now, updatedBy: actor.userId, updatedAt: now })
      .where(
        and(
          inArray(schema.platformPages.slug, [...MANAGED_PUBLIC_PAGE_SLUGS]),
          eq(schema.platformPages.status, 'draft'),
        ),
      )
      .returning();

    let count = pages.length;
    for (const page of pages) {
      await tx.insert(schema.platformContentRevisions).values({
        entityType: 'page',
        entityId: page.id,
        action: 'publish',
        afterJson: toPlatformJson(page),
        actorId: actor.userId,
      });

      const sections = await tx
        .update(schema.platformPageSections)
        .set({ status: 'published', publishedAt: now, updatedBy: actor.userId, updatedAt: now })
        .where(and(eq(schema.platformPageSections.pageId, page.id), eq(schema.platformPageSections.status, 'draft')))
        .returning();
      for (const section of sections) {
        await tx.insert(schema.platformContentRevisions).values({
          entityType: 'page_section',
          entityId: section.id,
          action: 'publish',
          afterJson: toPlatformJson(section),
          actorId: actor.userId,
        });
      }
      count += sections.length;
    }
    return count;
  });

  const auditRecorded = await recordAuditSafely({
    tenantSlug,
    actorUserId: actor.userId,
    actorEmail: actor.email,
    action: 'platform_content.published',
    mutatedRecords,
  });
  revalidatePublicPages(tenantSlug, MANAGED_PUBLIC_PAGE_SLUGS);

  return {
    ok: true as const,
    status: 'published' as const,
    actorEmail: actor.email,
    area: 'public-site' as const,
    entityType: 'page' as const,
    entityKey: ENTITY_KEY,
    mutatedRecords,
    auditRecorded,
  };
}

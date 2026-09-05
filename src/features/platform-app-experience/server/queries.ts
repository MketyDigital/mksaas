import { asc, eq, isNull } from 'drizzle-orm';

import { db } from '@/shared/db';
import {
  platformAppControlCenterModules,
  platformAppDashboardSettings,
  platformWorkspaceCards,
} from '@/shared/db/schema/platform-app-experience';

import { platformControlModules } from '../control-center-registry';
import { defaultAppExperience } from '../defaults';
import {
  appControlCenterModuleSchema,
  appDashboardSettingsSchema,
  appExperienceDefaultsSchema,
  workspaceCardSchema,
} from '../schemas';

const PUBLISHED = 'published' as const;

async function withFallback<T>(read: () => Promise<T | null | undefined>, fallback: T): Promise<T> {
  try {
    const value = await read();
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

export async function getPublishedAppExperience() {
  return withFallback(async () => {
    const dashboard = await db.query.platformAppDashboardSettings.findFirst({
      where: isNull(platformAppDashboardSettings.tenantId),
      orderBy: [asc(platformAppDashboardSettings.createdAt)],
    });

    const workspaces = await getPublishedWorkspaceCards();
    const controlCenterModules = await getPublishedControlCenterModules();

    if (!dashboard && workspaces.length === 0 && controlCenterModules.length === 0) return null;

    return appExperienceDefaultsSchema.parse({
      dashboard: dashboard
        ? {
            headline: dashboard.headline,
            description: dashboard.description ?? defaultAppExperience.dashboard.description,
            primaryCta: {
              label: dashboard.primaryCtaLabel,
              href: dashboard.primaryCtaHref,
            },
            secondaryCta:
              dashboard.secondaryCtaLabel && dashboard.secondaryCtaHref
                ? { label: dashboard.secondaryCtaLabel, href: dashboard.secondaryCtaHref }
                : undefined,
            support: dashboard.supportLabel && dashboard.supportHref ? { label: dashboard.supportLabel, href: dashboard.supportHref } : undefined,
          }
        : defaultAppExperience.dashboard,
      workspaces: workspaces.length > 0 ? workspaces : defaultAppExperience.workspaces,
      controlCenterModules: controlCenterModules.length > 0 ? controlCenterModules : platformControlModules,
    });
  }, defaultAppExperience);
}

export async function getPublishedWorkspaceCards() {
  return withFallback(async () => {
    const rows = await db.query.platformWorkspaceCards.findMany({
      where: eq(platformWorkspaceCards.status, PUBLISHED),
      orderBy: [asc(platformWorkspaceCards.sortOrder)],
    });

    if (rows.length === 0) return null;

    return rows
      .filter((workspace) => workspace.enabled !== false)
      .map((workspace) =>
        workspaceCardSchema.parse({
          key: workspace.workspaceKey,
          label: workspace.label,
          description: workspace.description,
          href: workspace.href,
          iconKey: workspace.iconKey ?? undefined,
          badgeLabel: workspace.badgeLabel ?? undefined,
          enabled: workspace.enabled,
          requiresEntitlement: workspace.requiresEntitlement ?? undefined,
          sortOrder: workspace.sortOrder,
        }),
      );
  }, defaultAppExperience.workspaces.filter((workspace) => workspace.enabled !== false).sort((a, b) => a.sortOrder - b.sortOrder));
}

export async function getPublishedControlCenterModules() {
  return withFallback(async () => {
    const rows = await db.query.platformAppControlCenterModules.findMany({
      where: eq(platformAppControlCenterModules.status, PUBLISHED),
      orderBy: [asc(platformAppControlCenterModules.sortOrder)],
    });

    if (rows.length === 0) return null;

    return rows
      .filter((module) => module.enabled !== false)
      .map((module) => {
        const metadata = module.metadataJson as {
          domain?: string;
          status?: string;
          editableScope?: string[];
          protectedScope?: string[];
          implementationNotes?: string;
        };

        return appControlCenterModuleSchema.parse({
          key: module.moduleKey,
          label: module.label,
          description: module.description,
          href: module.href,
          iconKey: module.iconKey ?? undefined,
          level: module.level,
          enabled: module.enabled,
          requiredPermission: module.requiredPermission,
          sortOrder: module.sortOrder,
          domain: metadata.domain ?? 'app.mkety.com',
          status: metadata.status ?? 'foundation',
          editableScope: metadata.editableScope ?? ['Approved admin configuration'],
          protectedScope: metadata.protectedScope ?? ['Backend logic and security-sensitive behavior'],
          implementationNotes: metadata.implementationNotes ?? 'Loaded from published platform app experience content.',
        });
      });
  }, platformControlModules.filter((module) => module.enabled !== false).sort((a, b) => a.sortOrder - b.sortOrder));
}

export async function getPublishedControlCenterModule(moduleKey: string) {
  return (await getPublishedControlCenterModules()).find((module) => module.key === moduleKey || module.href.endsWith(`/${moduleKey}`)) ?? null;
}

import { eq, isNull } from 'drizzle-orm';

import { db } from '@/shared/db';
import {
  platformAppControlCenterModules,
  platformAppDashboardSettings,
  platformWorkspaceCards,
} from '@/shared/db/schema/platform-app-experience';

import { platformControlModules } from '../control-center-registry';
import { defaultAppExperience } from '../defaults';

const PUBLISHED = 'published' as const;

type AppExperienceSeedResult = {
  dashboard: 'created' | 'exists';
  workspaceCards: number;
  controlCenterModules: number;
};

/**
 * Seeds global app.mkety.com presentation defaults.
 *
 * This is global Mkety app experience configuration, not tenant/customer data.
 * It intentionally does not create product entitlements, roles, billing records,
 * Auth Gateway keys, deployment jobs, or security policy changes.
 */
export async function seedDefaultPlatformAppExperience(): Promise<AppExperienceSeedResult> {
  const result: AppExperienceSeedResult = {
    dashboard: 'exists',
    workspaceCards: 0,
    controlCenterModules: 0,
  };

  const existingDashboard = await db.query.platformAppDashboardSettings.findFirst({
    where: isNull(platformAppDashboardSettings.tenantId),
  });

  if (!existingDashboard) {
    await db.insert(platformAppDashboardSettings).values({
      environment: 'production',
      tenantId: null,
      status: PUBLISHED,
      headline: defaultAppExperience.dashboard.headline,
      description: defaultAppExperience.dashboard.description,
      primaryCtaLabel: defaultAppExperience.dashboard.primaryCta.label,
      primaryCtaHref: defaultAppExperience.dashboard.primaryCta.href,
      secondaryCtaLabel: defaultAppExperience.dashboard.secondaryCta?.label,
      secondaryCtaHref: defaultAppExperience.dashboard.secondaryCta?.href,
      supportLabel: defaultAppExperience.dashboard.support?.label,
      supportHref: defaultAppExperience.dashboard.support?.href,
      metadataJson: {},
      publishedAt: new Date(),
    });
    result.dashboard = 'created';
  }

  for (const workspace of defaultAppExperience.workspaces) {
    const existing = await db.query.platformWorkspaceCards.findFirst({
      where: eq(platformWorkspaceCards.workspaceKey, workspace.key),
    });

    if (!existing) {
      await db.insert(platformWorkspaceCards).values({
        tenantId: null,
        workspaceKey: workspace.key,
        label: workspace.label,
        description: workspace.description,
        href: workspace.href,
        iconKey: workspace.iconKey,
        badgeLabel: workspace.badgeLabel,
        enabled: workspace.enabled,
        requiresEntitlement: workspace.requiresEntitlement,
        sortOrder: workspace.sortOrder,
        status: PUBLISHED,
        metadataJson: {},
        publishedAt: new Date(),
      });
      result.workspaceCards += 1;
    }
  }

  for (const controlModule of platformControlModules) {
    const existing = await db.query.platformAppControlCenterModules.findFirst({
      where: eq(platformAppControlCenterModules.moduleKey, controlModule.key),
    });

    if (!existing) {
      await db.insert(platformAppControlCenterModules).values({
        moduleKey: controlModule.key,
        label: controlModule.label,
        description: controlModule.description,
        href: controlModule.href,
        iconKey: controlModule.iconKey,
        level: controlModule.level,
        enabled: controlModule.enabled,
        requiredPermission: controlModule.requiredPermission,
        sortOrder: controlModule.sortOrder,
        status: PUBLISHED,
        metadataJson: {
          domain: controlModule.domain,
          status: controlModule.status,
          editableScope: controlModule.editableScope,
          protectedScope: controlModule.protectedScope,
          implementationNotes: controlModule.implementationNotes,
        },
        publishedAt: new Date(),
      });
      result.controlCenterModules += 1;
    }
  }

  return result;
}

'use server';

import { count, desc, eq } from 'drizzle-orm';

import { db } from '@/shared/db';
import { auditEvents, persons } from '@/shared/db/schema';
import { auth } from '@/shared/lib/auth';
import { getTenantBySlug } from '@/shared/lib/tenant';
import { logger } from '@/shared/lib/logger';

export interface DashboardStats {
  teamSize: number;
  recentActivity: ActivityItem[];
}

export interface ActivityItem {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  createdAt: Date;
}

export interface DashboardStatsResult {
  success: boolean;
  data?: DashboardStats;
  error?: string;
}

export async function getDashboardStats(tenantSlug: string): Promise<DashboardStatsResult> {
  try {
    const [session, tenant] = await Promise.all([
      auth(),
      getTenantBySlug(tenantSlug),
    ]);
    if (!session?.user?.email) {
      return { success: false, error: 'Not authenticated' };
    }
    if (!tenant || !(tenant.slug in (session.user.roles ?? {}))) {
      return { success: false, error: 'Not authorized' };
    }

    const [[teamCount], recentEvents] = await Promise.all([
      db.select({ count: count() }).from(persons).where(eq(persons.tenantId, tenant.id)),
      db.query.auditEvents.findMany({
        where: eq(auditEvents.tenantId, tenant.id),
        orderBy: [desc(auditEvents.timestamp)],
        limit: 10,
      }),
    ]);

    const recentActivity: ActivityItem[] = recentEvents.map((e) => ({
      id: e.id,
      action: e.action,
      entityType: e.entityType,
      entityId: e.entityId,
      createdAt: e.timestamp,
    }));

    return {
      success: true,
      data: {
        teamSize: teamCount?.count ?? 0,
        recentActivity,
      },
    };
  } catch (error) {
    logger.error({ error }, 'Error fetching dashboard stats');
    return { success: false, error: 'Failed to fetch dashboard stats' };
  }
}

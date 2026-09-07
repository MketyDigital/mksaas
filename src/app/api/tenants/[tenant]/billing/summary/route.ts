import { and, eq } from 'drizzle-orm';

import { drizzleBillingSummarySource } from '@/features/billing/server/drizzle-queries';
import {
  getTenantBillingSummary as buildTenantBillingSummary,
  type TenantBillingSummary,
} from '@/features/billing/server/queries';
import { db } from '@/shared/db';
import { tenantMemberships } from '@/shared/db/schema';
import { auth } from '@/shared/lib/auth';
import { getTenantBySlug } from '@/shared/lib/tenant';

export const dynamic = 'force-dynamic';

export interface BillingSummaryRouteDependencies {
  getCurrentUserId(): Promise<string | null>;
  findCurrentMembership(tenantSlug: string, userId: string): Promise<{ tenantId: string } | null>;
  getTenantBillingSummary(tenantId: string): Promise<TenantBillingSummary | null>;
}

interface BillingSummaryRouteContext {
  params: Promise<{ tenant: string }>;
}

interface JsonResponseLike {
  readonly status: number;
  json(): Promise<any>;
}

function jsonResponse(body: unknown, status = 200): JsonResponseLike {
  return {
    status,
    async json() {
      return body;
    },
  };
}

function jsonSafe(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, jsonSafe(item)]),
    );
  }
  return value;
}

export function createBillingSummaryHandler(dependencies: BillingSummaryRouteDependencies) {
  return async function billingSummaryHandler(
    _request: unknown,
    context: BillingSummaryRouteContext,
  ): Promise<JsonResponseLike> {
    const userId = await dependencies.getCurrentUserId();
    if (!userId) return jsonResponse({ error: 'Unauthorized' }, 401);

    const { tenant: tenantSlug } = await context.params;
    const membership = await dependencies.findCurrentMembership(tenantSlug, userId);
    if (!membership) return jsonResponse({ error: 'Forbidden' }, 403);

    const summary = await dependencies.getTenantBillingSummary(membership.tenantId);
    if (!summary) return jsonResponse({ error: 'Billing state not found' }, 404);

    return jsonResponse(jsonSafe(summary));
  };
}

const runtimeHandler = createBillingSummaryHandler({
  async getCurrentUserId() {
    return (await auth())?.user?.id ?? null;
  },

  async findCurrentMembership(tenantSlug, userId) {
    const tenant = await getTenantBySlug(tenantSlug);
    if (!tenant) return null;

    const membership = await db.query.tenantMemberships.findFirst({
      columns: { tenantId: true },
      where: and(eq(tenantMemberships.tenantId, tenant.id), eq(tenantMemberships.userId, userId)),
    });
    return membership ? { tenantId: membership.tenantId } : null;
  },

  getTenantBillingSummary(tenantId) {
    return buildTenantBillingSummary(drizzleBillingSummarySource, tenantId);
  },
});

export async function GET(request: Request, context: BillingSummaryRouteContext): Promise<Response> {
  const result = await runtimeHandler(request, context);
  const body = await result.json();
  return new Response(JSON.stringify(body), {
    status: result.status,
    headers: {
      'Cache-Control': 'private, no-store',
      'Content-Type': 'application/json',
    },
  });
}

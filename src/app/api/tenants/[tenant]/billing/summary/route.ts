import { NextResponse } from 'next/server';

import type { TenantBillingSummary } from '@/features/billing/server/queries';

export interface BillingSummaryRouteDependencies {
  getCurrentUserId(): Promise<string | null>;
  isCurrentTenantMember(userId: string, tenantId: string): Promise<boolean>;
  getSummary(tenantId: string): Promise<TenantBillingSummary>;
}

interface BillingSummaryRouteContext {
  params: Promise<{ tenant: string }>;
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
    _request: Request,
    context: BillingSummaryRouteContext,
  ): Promise<Response> {
    const userId = await dependencies.getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { tenant } = await context.params;
    if (!(await dependencies.isCurrentTenantMember(userId, tenant))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const summary = await dependencies.getSummary(tenant);
    return NextResponse.json(jsonSafe(summary), {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  };
}

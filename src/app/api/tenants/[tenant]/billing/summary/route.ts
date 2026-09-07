import type { TenantBillingSummary } from '@/features/billing/server/queries';

export interface BillingSummaryRouteDependencies {
  getCurrentUserId(): Promise<string | null>;
  isCurrentTenantMember(userId: string, tenantId: string): Promise<boolean>;
  getSummary(tenantId: string): Promise<TenantBillingSummary>;
}

interface BillingSummaryRouteContext {
  params: Promise<{ tenant: string }>;
}

interface JsonResponseLike {
  readonly status: number;
  readonly headers: Headers;
  json(): Promise<unknown>;
}

function jsonResponse(body: unknown, status = 200): JsonResponseLike {
  return {
    status,
    headers: new Headers({
      'Cache-Control': 'private, no-store',
      'Content-Type': 'application/json',
    }),
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

    const { tenant } = await context.params;
    if (!(await dependencies.isCurrentTenantMember(userId, tenant))) {
      return jsonResponse({ error: 'Forbidden' }, 403);
    }

    return jsonResponse(jsonSafe(await dependencies.getSummary(tenant)));
  };
}

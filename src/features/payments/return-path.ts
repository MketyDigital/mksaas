type PaymentSurface = 'billing' | 'enterprise-ai';
type PaymentReturnState = 'returned' | 'cancelled';

const TENANT_SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const SAFE_QUERY_VALUES: Record<string, RegExp> = {
  plan: /^[a-z0-9-]{1,80}$/,
  term: /^\d{1,3}m$/,
  payment: /^(?:returned|cancelled)$/,
  currency: /^[A-Z]{3}$/,
};

function tenantPath(tenantSlug: string, surface: PaymentSurface) {
  if (!TENANT_SLUG_PATTERN.test(tenantSlug)) throw new Error('Invalid payment return tenant.');
  return surface === 'billing'
    ? `/app/${tenantSlug}/billing/checkout`
    : `/app/${tenantSlug}/enterprise-ai`;
}

export function buildTenantPaymentReturnPath(input: {
  tenantSlug: string;
  surface: PaymentSurface;
  planKey?: string;
  termKey?: string;
  currency?: string;
  state?: PaymentReturnState;
}): string {
  const path = tenantPath(input.tenantSlug, input.surface);
  const params = new URLSearchParams();
  if (input.planKey) params.set('plan', input.planKey);
  if (input.termKey) params.set('term', input.termKey);
  if (input.currency) params.set('currency', input.currency);
  if (input.state) params.set('payment', input.state);
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

export function normalizeTenantPaymentReturnPath(value: string, tenantSlug: string): string | null {
  if (!TENANT_SLUG_PATTERN.test(tenantSlug) || !value.startsWith('/') || value.startsWith('//')) return null;

  try {
    const parsed = new URL(value, 'https://mkety.invalid');
    if (
      parsed.origin !== 'https://mkety.invalid' ||
      parsed.username ||
      parsed.password ||
      parsed.hash
    ) {
      return null;
    }

    const allowedPaths = new Set([
      `/app/${tenantSlug}/billing/checkout`,
      `/app/${tenantSlug}/enterprise-ai`,
      `/t/${tenantSlug}/billing/checkout`,
      `/t/${tenantSlug}/enterprise-ai`,
    ]);
    if (!allowedPaths.has(parsed.pathname)) return null;

    const params = new URLSearchParams();
    for (const [key, item] of parsed.searchParams) {
      const pattern = SAFE_QUERY_VALUES[key];
      if (!pattern || !pattern.test(item) || parsed.searchParams.getAll(key).length !== 1) return null;
      params.set(key, item);
    }

    const canonicalPath = parsed.pathname.replace(/^\/t\//, '/app/');
    const query = params.toString();
    return query ? `${canonicalPath}?${query}` : canonicalPath;
  } catch {
    return null;
  }
}

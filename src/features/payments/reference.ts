export type MketyPaymentSource = 'saas' | 'media' | 'host' | 'enterprise';

const SOURCE_PREFIX: Record<MketyPaymentSource, string> = {
  saas: 'SAAS-MKS',
  media: 'MEDIA-MKM',
  host: 'HOST-MKH',
  enterprise: 'ENT-MKE',
};

const UUID_COMPACT_PATTERN = /^[0-9a-f]{32}$/i;

function compactUuid(value: string): string | null {
  const compact = value.replace(/-/g, '');
  return UUID_COMPACT_PATTERN.test(compact) ? compact.toLowerCase() : null;
}

function expandUuid(value: string): string | null {
  if (!UUID_COMPACT_PATTERN.test(value)) return null;
  const v = value.toLowerCase();
  return `${v.slice(0, 8)}-${v.slice(8, 12)}-${v.slice(12, 16)}-${v.slice(16, 20)}-${v.slice(20)}`;
}

export function createMketyPaymentReference(source: MketyPaymentSource, targetId?: string): string {
  const token = targetId ? compactUuid(targetId) : null;
  const suffix = token ?? crypto.randomUUID().replace(/-/g, '').slice(0, 20);
  const reference = `${SOURCE_PREFIX[source]}-${suffix}`;
  if (reference.length > 42) throw new Error('Mkety payment reference exceeds provider limits.');
  return reference;
}

export function parseMketyPaymentReference(reference: string): {
  source: MketyPaymentSource;
  token: string;
  targetUuid?: string;
} | null {
  for (const [source, prefix] of Object.entries(SOURCE_PREFIX) as Array<[MketyPaymentSource, string]>) {
    const marker = `${prefix}-`;
    if (!reference.startsWith(marker)) continue;
    const token = reference.slice(marker.length);
    if (!/^[a-zA-Z0-9-]{6,32}$/.test(token)) return null;
    return {
      source,
      token,
      targetUuid: expandUuid(token) ?? undefined,
    };
  }
  return null;
}

export function buildMketyPaymentMetadata(input: {
  source: MketyPaymentSource;
  invoiceId?: string;
  tenantId?: string;
  checkoutId?: string;
  orderId?: string;
}) {
  return {
    source: input.source,
    ...(input.invoiceId ? { invoice_id: input.invoiceId } : {}),
    ...(input.tenantId ? { tenant_id: input.tenantId } : {}),
    ...(input.checkoutId ? { checkout_id: input.checkoutId } : {}),
    ...(input.orderId ? { order_id: input.orderId } : {}),
  };
}


function metadataRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export function resolveMketyPaymentRoute(
  reference: string,
  providerData?: Record<string, unknown>,
): {
  source: MketyPaymentSource;
  targetUuid?: string;
  metadata: Record<string, unknown>;
} | null {
  const canonical = parseMketyPaymentReference(reference);
  const meta = metadataRecord(providerData?.meta ?? providerData?.metadata);
  const metadataSource =
    meta.source === 'saas' || meta.source === 'media' || meta.source === 'host' || meta.source === 'enterprise'
      ? (meta.source as MketyPaymentSource)
      : undefined;

  if (canonical) {
    if (metadataSource && metadataSource !== canonical.source) {
      throw new Error('Mkety payment source metadata conflicts with the payment reference.');
    }
    return { source: canonical.source, targetUuid: canonical.targetUuid, metadata: meta };
  }

  // Mkety Media currently issues MKM-* invoice references. These are already
  // Mkety-owned references, so a verified provider transaction can route them
  // to Media even when an older provider integration did not persist source metadata.
  if (/^MKM-[A-Z0-9]{6,32}$/i.test(reference)) {
    if (metadataSource && metadataSource !== 'media') {
      throw new Error('Mkety payment source metadata conflicts with the Media payment reference.');
    }
    return { source: 'media', metadata: meta };
  }

  return null;
}

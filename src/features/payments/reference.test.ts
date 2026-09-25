import {
  buildMketyPaymentMetadata,
  createMketyPaymentReference,
  parseMketyPaymentReference,
} from './reference';

describe('Mkety payment references', () => {
  it('encodes a SaaS checkout UUID in a Flutterwave-safe reference and recovers it', () => {
    const checkoutId = '5e0d1f40-6bf5-4efd-bd75-a2223fb8ff91';
    const reference = createMketyPaymentReference('saas', checkoutId);

    expect(reference).toBe('SAAS-MKS-5e0d1f406bf54efdbd75a2223fb8ff91');
    expect(reference.length).toBeLessThanOrEqual(42);
    expect(parseMketyPaymentReference(reference)).toEqual({
      source: 'saas',
      token: '5e0d1f406bf54efdbd75a2223fb8ff91',
      targetUuid: checkoutId,
    });
  });

  it('routes Media and future Host references without guessing from provider payloads', () => {
    expect(parseMketyPaymentReference('MEDIA-MKM-A83K27')).toEqual({
      source: 'media',
      token: 'A83K27',
      targetUuid: undefined,
    });
    expect(parseMketyPaymentReference('HOST-MKH-8G7P21')?.source).toBe('host');
  });

  it('builds explicit Mkety-owned metadata for downstream routing', () => {
    expect(buildMketyPaymentMetadata({
      source: 'media',
      invoiceId: 'invoice-1',
      tenantId: 'tenant-1',
    })).toEqual({
      source: 'media',
      invoice_id: 'invoice-1',
      tenant_id: 'tenant-1',
    });
  });

  it('rejects unknown prefixes', () => {
    expect(parseMketyPaymentReference('OTHER-123456')).toBeNull();
  });
});

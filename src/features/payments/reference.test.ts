import {
  buildMketyPaymentMetadata,
  createMketyPaymentReference,
  parseMketyPaymentReference,
  resolveMketyPaymentRoute,
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

  it('routes current Media MKM references and rejects conflicting source metadata', () => {
    expect(resolveMketyPaymentRoute('MKM-A83K27', { meta: { source: 'media', invoice_id: 'inv-1' } })).toEqual({
      source: 'media',
      metadata: { source: 'media', invoice_id: 'inv-1' },
    });
    expect(resolveMketyPaymentRoute('MKM-A83K27')).toEqual({
      source: 'media',
      metadata: {},
    });
    expect(() => resolveMketyPaymentRoute('MKM-A83K27', { meta: { source: 'saas' } })).toThrow('conflicts');
  });

  it('rejects metadata that conflicts with a canonical reference prefix', () => {
    expect(() =>
      resolveMketyPaymentRoute('SAAS-MKS-5e0d1f406bf54efdbd75a2223fb8ff91', {
        meta: { source: 'media' },
      }),
    ).toThrow('conflicts');
  });

  it('does not route an unknown reference from metadata alone', () => {
    expect(resolveMketyPaymentRoute('OTHER-123456', { meta: { source: 'enterprise', order_id: 'MKETY-ENT-123' } })).toBeNull();
  });

  it('rejects unknown prefixes', () => {
    expect(parseMketyPaymentReference('OTHER-123456')).toBeNull();
  });
});

import { DomainNameApiAdapter } from './domainnameapi';

function mockJsonResponse(payload: unknown, status: number) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn(async () => payload),
  } as unknown as Response;
}

const contact = {
  firstName: 'Mfon',
  lastName: 'Sambo',
  email: 'owner@example.com',
  companyName: 'Mkety',
  address: '1 Example Street',
  city: 'Uyo',
  state: 'Akwa Ibom',
  country: 'NG',
  postalCode: '520001',
  phoneCountryCode: '234',
  phone: '8012345678',
};

describe('DomainNameApiAdapter', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('uses the official REST SDK auth headers and bulk-search endpoint', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockJsonResponse({
        infos: [{
          domainName: 'example.com',
          status: 'available',
          price: 10.81,
          renewalPrice: 12.5,
          currency: 'USD',
        }],
      }, 200),
    );

    const adapter = new DomainNameApiAdapter({
      resellerId: 'provider-issued-reseller-id',
      apiKey: 'test-token',
      environment: 'ote',
    });

    await expect(adapter.quote('example.com')).resolves.toMatchObject({
      domain: 'example.com',
      available: true,
      providerRegistrationPriceMinor: 1081n,
      providerRenewalPriceMinor: 1250n,
      registrationPriceMinor: 1081n,
      renewalPriceMinor: 1250n,
      currency: 'USD',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://ote.domainresellerapi.com/api/v1/domains/bulk-search',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'X-API-KEY': 'test-token',
          __reseller: 'provider-issued-reseller-id',
        }),
        body: JSON.stringify([{ domainName: 'example.com' }]),
      }),
    );
  });

  it('keeps production opt-in explicit', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockJsonResponse({ infos: [{ domainName: 'example.net', status: 'available', price: 10, renewalPrice: 12, currency: 'USD' }] }, 200),
    );
    const adapter = new DomainNameApiAdapter({
      resellerId: 'provider-issued-reseller-id',
      apiKey: 'test-token',
      environment: 'production',
    });
    await adapter.quote('example.net');
    expect(fetchMock.mock.calls.at(-1)?.[0]).toBe(
      'https://api.domainresellerapi.com/api/v1/domains/bulk-search',
    );
  });

  it('routes official REST quote traffic through the fixed-egress relay', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockJsonResponse({ infos: [{ domainName: 'relay-test.com', status: 'available', price: 8.25, renewalPrice: 9.5, currency: 'USD' }] }, 200),
    );
    const adapter = new DomainNameApiAdapter({
      resellerId: 'provider-issued-reseller-id',
      apiKey: 'live-api-key',
      environment: 'production',
      relayUrl: 'https://registrar-relay.mkety.com/',
      relaySecret: '0123456789abcdef0123456789abcdef',
    });

    await expect(adapter.quote('relay-test.com')).resolves.toMatchObject({
      available: true,
      registrationPriceMinor: 825n,
    });

    const quoteCall = fetchMock.mock.calls.find(([url]) => url === 'https://registrar-relay.mkety.com/v1/domainnameapi');
    expect(quoteCall).toBeDefined();
    const [, init] = quoteCall!;
    const relayBody = JSON.parse(String(init?.body));
    expect(relayBody).toEqual(expect.objectContaining({
      operation: 'quote',
      environment: 'production',
      nonce: expect.stringMatching(/^[0-9a-f-]{36}$/i),
      payload: {
        resellerId: 'provider-issued-reseller-id',
        apiKey: 'live-api-key',
        domainName: 'relay-test.com',
        period: 1,
      },
    }));
  });


  it('keeps provider base pricing visible and applies editable sell-price markup', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockJsonResponse({
        infos: [{
          domainName: 'markup.com',
          status: 'available',
          price: 10,
          renewalPrice: 20,
          currency: 'USD',
        }],
      }, 200),
    );
    const adapter = new DomainNameApiAdapter({
      resellerId: 'provider-issued-reseller-id',
      apiKey: 'test-token',
      environment: 'production',
      registrationMarkupPercent: 25,
      renewalMarkupPercent: 10,
      registrationFixedMarkupMinor: 100n,
      renewalFixedMarkupMinor: 50n,
    });

    await expect(adapter.quote('markup.com')).resolves.toMatchObject({
      providerRegistrationPriceMinor: 1000n,
      providerRenewalPriceMinor: 2000n,
      registrationPriceMinor: 1350n,
      renewalPriceMinor: 2250n,
      registrationMarkupPercent: 25,
      renewalMarkupPercent: 10,
    });
  });

  it('uses the provider TLD catalog when availability omits renewal pricing', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(mockJsonResponse({
        infos: [{ domainName: 'catalog.com', status: 'available', price: 9, currency: 'USD' }],
      }, 200))
      .mockResolvedValueOnce(mockJsonResponse({
        items: [{
          name: 'com',
          prices: [{
            renew: [{ period: 1, price: 14.25, currency: 'USD' }],
          }],
        }],
      }, 200));

    const adapter = new DomainNameApiAdapter({
      resellerId: 'provider-issued-reseller-id',
      apiKey: 'test-token',
      environment: 'production',
    });

    await expect(adapter.quote('catalog.com')).resolves.toMatchObject({
      providerRegistrationPriceMinor: 900n,
      providerRenewalPriceMinor: 1425n,
      renewalPriceMinor: 1425n,
    });
    expect(fetchMock.mock.calls.at(1)?.[0]).toBe(
      'https://api.domainresellerapi.com/api/v1/products/tlds?MaxResultCount=500&SkipCount=0',
    );
  });


  it('retries transient quote failures but never mutation failures', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(mockJsonResponse({ message: 'temporary upstream failure' }, 502))
      .mockResolvedValueOnce(mockJsonResponse({ message: 'temporary upstream failure' }, 503))
      .mockResolvedValueOnce(mockJsonResponse({
        infos: [{
          domainName: 'retry.com',
          status: 'available',
          price: 11,
          renewalPrice: 12,
          currency: 'USD',
        }],
      }, 200));

    const adapter = new DomainNameApiAdapter({
      resellerId: 'provider-issued-reseller-id',
      apiKey: 'test-token',
      environment: 'production',
    });

    await expect(adapter.quote('retry.com')).resolves.toMatchObject({
      available: true,
      registrationPriceMinor: 1100n,
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);

    fetchMock.mockReset().mockResolvedValue(mockJsonResponse({ message: 'temporary upstream failure' }, 502));
    await expect(adapter.register({
      domain: 'retry-mutation.com',
      years: 1,
      idempotencyKey: 'order-retry-1',
      contact,
    })).rejects.toThrow('DomainNameAPI register failed (502)');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('registers only with the official full-contact REST payload', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockJsonResponse({
        domainName: 'example.com',
        expirationDate: '2027-10-01T00:00:00Z',
      }, 200),
    );
    const adapter = new DomainNameApiAdapter({
      resellerId: 'provider-issued-reseller-id',
      apiKey: 'test-token',
      environment: 'ote',
    });

    await expect(adapter.register({
      domain: 'example.com',
      years: 1,
      idempotencyKey: 'order-1',
      contact,
    })).resolves.toMatchObject({ domain: 'example.com' });

    const [url, init] = fetchMock.mock.calls.at(-1)!;
    expect(url).toBe('https://ote.domainresellerapi.com/api/v1/domains/register-with-contacts');
    const body = JSON.parse(String(init?.body));
    expect(body).toEqual(expect.objectContaining({
      domainName: 'example.com',
      period: 1,
      isLocked: true,
      privacyEnabled: true,
      contacts: expect.arrayContaining([
        expect.objectContaining({ contactType: 'Registrant', country: 'NG', eMail: 'owner@example.com' }),
        expect.objectContaining({ contactType: 'Admin' }),
        expect.objectContaining({ contactType: 'Tech' }),
        expect.objectContaining({ contactType: 'Billing' }),
      ]),
      tldAttributes: {},
    }));
  });

  it('uses the official renewal endpoint without legacy expiry lookups', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockJsonResponse({
        domainName: 'renew-me.com',
        expirationDate: '2028-10-01T00:00:00Z',
      }, 200),
    );
    const adapter = new DomainNameApiAdapter({
      resellerId: 'provider-issued-reseller-id',
      apiKey: 'test-token',
      environment: 'production',
    });

    await expect(adapter.renew({
      providerDomainRef: 'renew-me.com',
      years: 1,
      idempotencyKey: 'renew-order-1',
    })).resolves.toMatchObject({ domain: 'renew-me.com' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.domainresellerapi.com/api/v1/domains/renew',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ domainName: 'renew-me.com', period: 1 }),
      }),
    );
  });

  it('does not retry an ambiguous provider mutation failure', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockJsonResponse({ message: 'upstream timeout' }, 500),
    );
    const adapter = new DomainNameApiAdapter({
      resellerId: 'provider-issued-reseller-id',
      apiKey: 'test-token',
      environment: 'ote',
    });
    await expect(adapter.register({
      domain: 'example.com',
      years: 1,
      idempotencyKey: 'order-1',
      contact,
    })).rejects.toThrow('DomainNameAPI register failed (500)');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

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
      registrationPriceMinor: 1081n,
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
      mockJsonResponse({ infos: [{ domainName: 'example.net', status: 'available', price: 10, currency: 'USD' }] }, 200),
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
      mockJsonResponse({ infos: [{ domainName: 'relay-test.com', status: 'available', price: 8.25, currency: 'USD' }] }, 200),
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

    const [, init] = fetchMock.mock.calls.at(-1)!;
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

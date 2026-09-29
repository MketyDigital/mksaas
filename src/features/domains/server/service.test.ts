jest.mock('./managed-domain-service', () => ({
  recordManagedDomainAfterRegistration: jest.fn(async () => null),
}));

import { configureDomainResellerAdapter } from './reseller';
import {
  quoteDomainRegistration,
  registerDomainAfterVerifiedSettlement,
  renewDomainAfterVerifiedSettlement,
} from './service';

describe('system-wide domain reseller service', () => {
  const quote = jest.fn();
  const register = jest.fn();
  const renew = jest.fn();
  const setNameServers = jest.fn();

  beforeEach(() => {
    quote.mockReset();
    register.mockReset();
    renew.mockReset();
    setNameServers.mockReset();
    configureDomainResellerAdapter({ quote, register, renew, setNameServers });
  });

  it('delegates quotes to the configured system-wide reseller', async () => {
    quote.mockResolvedValue({
      domain: 'example.com',
      available: true,
      registrationPriceMinor: 1000n,
      renewalPriceMinor: 1200n,
      currency: 'USD',
    });
    await quoteDomainRegistration('example.com', 1);
    expect(quote).toHaveBeenCalledWith('example.com', 1);
  });

  it('never registers before verified settlement', async () => {
    await expect(registerDomainAfterVerifiedSettlement({
      tenantId: '00000000-0000-0000-0000-000000000001',
      domain: 'example.com',
      years: 1,
      contact: {
        firstName: 'Mfon',
        lastName: 'Sambo',
        email: 'owner@example.com',
        address: '1 Example Street',
        city: 'Uyo',
        state: 'Akwa Ibom',
        country: 'NG',
        postalCode: '520001',
        phoneCountryCode: '234',
        phone: '8012345678',
      },
      orderId: 'order-1',
      settlementVerified: false,
    })).rejects.toThrow('verified settlement');
    expect(register).not.toHaveBeenCalled();
  });

  it('derives stable Mkety idempotency keys from verified orders', async () => {
    register.mockResolvedValue({ domain: 'example.com', expiresAt: null, providerDomainRef: 'example.com' });
    await registerDomainAfterVerifiedSettlement({
      tenantId: '00000000-0000-0000-0000-000000000001',
      domain: 'example.com',
      years: 1,
      contact: {
        firstName: 'Mfon',
        lastName: 'Sambo',
        email: 'owner@example.com',
        address: '1 Example Street',
        city: 'Uyo',
        state: 'Akwa Ibom',
        country: 'NG',
        postalCode: '520001',
        phoneCountryCode: '234',
        phone: '8012345678',
      },
      orderId: 'order-1',
      settlementVerified: true,
    });
    expect(register).toHaveBeenCalledWith(expect.objectContaining({
      idempotencyKey: 'domain-register:order-1',
    }));

    renew.mockResolvedValue({ domain: 'example.com', expiresAt: null, providerDomainRef: 'example.com' });
    await renewDomainAfterVerifiedSettlement({
      providerDomainRef: 'example.com',
      years: 1,
      orderId: 'renewal-1',
      settlementVerified: true,
    });
    expect(renew).toHaveBeenCalledWith(expect.objectContaining({
      idempotencyKey: 'domain-renew:renewal-1',
    }));
  });
});

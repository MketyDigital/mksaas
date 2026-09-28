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

  beforeEach(() => {
    quote.mockReset();
    register.mockReset();
    renew.mockReset();
    configureDomainResellerAdapter({ quote, register, renew });
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
      domain: 'example.com',
      years: 1,
      contactRef: 'contact-1',
      orderId: 'order-1',
      settlementVerified: false,
    })).rejects.toThrow('verified settlement');
    expect(register).not.toHaveBeenCalled();
  });

  it('derives stable Mkety idempotency keys from verified orders', async () => {
    register.mockResolvedValue({ domain: 'example.com', expiresAt: null, providerDomainRef: 'example.com' });
    await registerDomainAfterVerifiedSettlement({
      domain: 'example.com',
      years: 1,
      contactRef: 'contact-1',
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

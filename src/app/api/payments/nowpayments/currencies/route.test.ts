/** @jest-environment node */

const mockFetchCurrencies = jest.fn();
const mockDefaultCurrency = jest.fn();

jest.mock('@/features/payments/nowpayments-currencies', () => ({
  fetchNowPaymentsCurrencies: (...args: unknown[]) => mockFetchCurrencies(...args),
  defaultNowPaymentsCurrency: (...args: unknown[]) => mockDefaultCurrency(...args),
}));

import { GET } from './route';

describe('NOWPayments public currency list endpoint', () => {
  const originalApiKey = process.env.NOWPAYMENTS_API_KEY;

  afterEach(() => {
    if (originalApiKey === undefined) delete process.env.NOWPAYMENTS_API_KEY;
    else process.env.NOWPAYMENTS_API_KEY = originalApiKey;
    jest.clearAllMocks();
  });

  it('returns only normalized choices and a default without caching customer data', async () => {
    process.env.NOWPAYMENTS_API_KEY = 'private-api-key';
    mockFetchCurrencies.mockResolvedValue(['USDTTON', 'USDTTRC20']);
    mockDefaultCurrency.mockReturnValue('USDTTON');
    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual({
      currencies: ['USDTTON', 'USDTTRC20'],
      defaultCurrency: 'USDTTON',
      source: 'nowpayments',
    });
    expect(mockFetchCurrencies).toHaveBeenCalledWith({ apiKey: 'private-api-key' });
  });

  it('returns a safe unavailable response when credentials or provider are unavailable', async () => {
    delete process.env.NOWPAYMENTS_API_KEY;
    const missing = await GET();
    expect(missing.status).toBe(503);
    expect(await missing.json()).toEqual({ currencies: [], defaultCurrency: null, source: 'unavailable' });
    process.env.NOWPAYMENTS_API_KEY = 'private-api-key';
    mockFetchCurrencies.mockRejectedValue(new Error('provider response contained a secret'));
    const unavailable = await GET();
    expect(unavailable.status).toBe(503);
    expect(await unavailable.json()).toEqual({ currencies: [], defaultCurrency: null, source: 'unavailable' });
  });
});

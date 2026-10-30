import {
  defaultNowPaymentsCurrency,
  fetchNowPaymentsCurrencies,
  normalizeNowPaymentsCurrencies,
} from './nowpayments-currencies';

function response(body: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

describe('NOWPayments active currency choices', () => {
  it('normalizes distinct network tickers and skips malformed entries', () => {
    expect(normalizeNowPaymentsCurrencies(['usdttrc20', 'USDTTON', 'usdttrc20', '', 'bad ticker', 3]))
      .toEqual(['USDTTRC20', 'USDTTON']);
  });

  it('prefers TON, then TRC20, then the provider first currency', () => {
    expect(defaultNowPaymentsCurrency(['BTC', 'USDTTRC20', 'USDTTON'])).toBe('USDTTON');
    expect(defaultNowPaymentsCurrency(['BTC', 'USDTTRC20'])).toBe('USDTTRC20');
    expect(defaultNowPaymentsCurrency(['BTC', 'ETH'])).toBe('BTC');
    expect(defaultNowPaymentsCurrency([])).toBeNull();
  });

  it('uses the authenticated provider endpoint and fails closed on unavailable lists', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(response({ currencies: ['USDTTON'] }));
    await expect(fetchNowPaymentsCurrencies({ apiKey: 'private', fetchImpl })).resolves.toEqual(['USDTTON']);
    expect(fetchImpl).toHaveBeenCalledWith('https://api.nowpayments.io/v1/currencies', expect.objectContaining({
      headers: { 'x-api-key': 'private' },
    }));
    await expect(fetchNowPaymentsCurrencies({ apiKey: 'private', fetchImpl: jest.fn().mockResolvedValue(response({}, 503)) }))
      .rejects.toThrow(/currency list is unavailable/);
  });
});

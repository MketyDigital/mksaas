import {
  getAvailableMketyPaymentProviders,
  getMketyPaymentProviderStatuses,
  type MketyPaymentProviderInput,
} from './provider-availability';

const configured: MketyPaymentProviderInput = {
  nowpayments: { apiKey: 'np-api', ipnSecret: 'np-ipn' },
  flutterwave: {
    brokerSecret: 'fw-broker',
    collectionCurrencies: ['USD', 'NGN'],
    hasConfiguredCurrencyQuote: true,
  },
  kora: { publicKey: 'kora-public', secretKey: 'kora-secret' },
};

describe('Mkety payment provider availability', () => {
  it('returns configured methods in default order without credential values', () => {
    const providers = getAvailableMketyPaymentProviders(configured);

    expect(providers.map(({ provider }) => provider)).toEqual([
      'nowpayments',
      'flutterwave',
      'kora',
    ]);
    expect(JSON.stringify(providers)).not.toMatch(/np-api|np-ipn|fw-broker|kora-public|kora-secret/);
  });

  it.each([
    ['NOWPayments only', { nowpayments: configured.nowpayments }],
    ['Flutterwave only', { flutterwave: configured.flutterwave }],
    ['Kora only', { kora: configured.kora }],
  ])('allows %s without requiring optional providers', (_label, partial) => {
    expect(getAvailableMketyPaymentProviders({ ...partial } as MketyPaymentProviderInput)).toHaveLength(1);
  });

  it('omits incomplete optional providers without hiding complete methods', () => {
    const providers = getAvailableMketyPaymentProviders({
      ...configured,
      flutterwave: { ...configured.flutterwave, brokerSecret: '' },
      kora: { ...configured.kora, secretKey: '' },
    });

    expect(providers.map(({ provider }) => provider)).toEqual(['nowpayments']);
  });

  it('requires an operator-stored currency quote before advertising Flutterwave', () => {
    expect(
      getAvailableMketyPaymentProviders({
        ...configured,
        flutterwave: {
          ...configured.flutterwave,
          collectionCurrencies: ['USD'],
          hasConfiguredCurrencyQuote: false,
        },
      }).map(({ provider }) => provider),
    ).toEqual(['nowpayments', 'kora']);
  });

  it('does not count the implicit USD identity quote as an operator-configured quote', () => {
    const statuses = getMketyPaymentProviderStatuses({
      ...configured,
      flutterwave: {
        ...configured.flutterwave,
        collectionCurrencies: ['USD'],
        hasConfiguredCurrencyQuote: false,
      },
    });

    expect(statuses.find(({ provider }) => provider === 'flutterwave')?.ready).toBe(false);
  });

  it('returns generic ordered readiness for the operator dashboard', () => {
    const statuses = getMketyPaymentProviderStatuses(configured);

    expect(statuses.map(({ provider, ready }) => [provider, ready])).toEqual([
      ['nowpayments', true],
      ['flutterwave', true],
      ['kora', true],
    ]);
    expect(JSON.stringify(statuses)).not.toMatch(/np-api|np-ipn|fw-broker|kora-public|kora-secret/);
  });

  it('shows incomplete providers to operators without advertising them to customers', () => {
    const input = {
      ...configured,
      nowpayments: { apiKey: 'np-api' },
      flutterwave: { ...configured.flutterwave, brokerSecret: '' },
      kora: { publicKey: 'kora-public' },
    };

    expect(getMketyPaymentProviderStatuses(input).map(({ ready }) => ready)).toEqual([
      false,
      false,
      false,
    ]);
    expect(getAvailableMketyPaymentProviders(input)).toEqual([]);
  });
});

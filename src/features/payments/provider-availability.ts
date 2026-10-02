export type MketyCheckoutProvider = 'nowpayments' | 'flutterwave' | 'kora';

export interface MketyPaymentProviderInput {
  nowpayments?: {
    apiKey?: string;
    ipnSecret?: string;
  };
  flutterwave?: {
    brokerSecret?: string;
    collectionCurrencies?: readonly string[];
    hasConfiguredCurrencyQuote?: boolean;
  };
  kora?: {
    publicKey?: string;
    secretKey?: string;
  };
}

export interface MketyPaymentProviderStatus {
  provider: MketyCheckoutProvider;
  label: string;
  detail: string;
  ready: boolean;
}

export type PaymentProviderOption = Omit<MketyPaymentProviderStatus, 'ready'>;

const PROVIDER_DETAILS: Record<MketyCheckoutProvider, Omit<MketyPaymentProviderStatus, 'ready'>> = {
  nowpayments: {
    provider: 'nowpayments',
    label: 'Crypto',
    detail: 'Primary payment method · supported digital assets.',
  },
  flutterwave: {
    provider: 'flutterwave',
    label: 'Card / local methods',
    detail: 'Flutterwave v3 Inline opens securely over Mkety · methods depend on your currency and merchant availability.',
  },
  kora: {
    provider: 'kora',
    label: 'Card / bank',
    detail: 'Kora secure checkout is embedded inside Mkety.',
  },
};

function isConfigured(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

export function getMketyPaymentProviderStatuses(
  input: MketyPaymentProviderInput,
): MketyPaymentProviderStatus[] {
  return [
    {
      ...PROVIDER_DETAILS.nowpayments,
      ready: isConfigured(input.nowpayments?.apiKey) && isConfigured(input.nowpayments?.ipnSecret),
    },
    {
      ...PROVIDER_DETAILS.flutterwave,
      ready:
        isConfigured(input.flutterwave?.brokerSecret) &&
        input.flutterwave?.hasConfiguredCurrencyQuote === true &&
        (input.flutterwave?.collectionCurrencies?.length ?? 0) > 0,
    },
    {
      ...PROVIDER_DETAILS.kora,
      ready: isConfigured(input.kora?.publicKey) && isConfigured(input.kora?.secretKey),
    },
  ];
}

export function getAvailableMketyPaymentProviders(
  input: MketyPaymentProviderInput,
): PaymentProviderOption[] {
  return getMketyPaymentProviderStatuses(input)
    .filter(({ ready }) => ready)
    .map(({ ready: _ready, ...option }) => option);
}

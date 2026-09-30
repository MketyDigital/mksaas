export type MketyFlutterwavePaymentMethod = {
  key: string;
  label: string;
  group: 'Cards' | 'Bank Transfer' | 'Mobile Money' | 'Banks' | 'Wallets' | 'Others';
  currencyHints: readonly string[];
  note?: string;
};

/**
 * Customer-facing method catalogue only.
 *
 * Mkety intentionally does NOT send Flutterwave `payment_options`. Flutterwave's
 * dashboard remains authoritative for enabled/pending-review methods and filters
 * methods that are not valid for the selected transaction currency.
 */
export const MKETY_FLUTTERWAVE_PAYMENT_METHODS: readonly MketyFlutterwavePaymentMethod[] = [
  { key: 'local-cards', label: 'Local Cards', group: 'Cards', currencyHints: ['Global'] },
  { key: 'international-cards', label: 'International Cards', group: 'Cards', currencyHints: ['Global'], note: 'Subject to Flutterwave account approval.' },
  { key: 'bank-transfer-ng', label: 'Bank Transfer - Nigeria', group: 'Bank Transfer', currencyHints: ['NGN'] },
  { key: 'bank-transfer-gh', label: 'Bank Transfer - Ghana', group: 'Bank Transfer', currencyHints: ['GHS'], note: 'Shown when enabled/approved by Flutterwave.' },
  { key: 'momo-ghana', label: 'Momo Ghana', group: 'Mobile Money', currencyHints: ['GHS'] },
  { key: 'momo-rwanda', label: 'Momo Rwanda', group: 'Mobile Money', currencyHints: ['RWF'] },
  { key: 'momo-uganda', label: 'Momo Uganda', group: 'Mobile Money', currencyHints: ['UGX'] },
  { key: 'pay-with-bank-ng', label: 'Pay With Bank - Nigeria', group: 'Banks', currencyHints: ['NGN'] },
  { key: 'pay-with-bank-uk-eu', label: 'Pay With Bank - UK and EU', group: 'Banks', currencyHints: ['GBP', 'EUR'] },
  { key: 'pay-with-bank-za', label: 'Pay With Bank - South Africa', group: 'Banks', currencyHints: ['ZAR'] },
  { key: 'apple-pay', label: 'Apple Pay', group: 'Wallets', currencyHints: ['Provider/account eligible'], note: 'Availability is controlled by Flutterwave and the customer device/account.' },
  { key: 'google-pay', label: 'Google Pay', group: 'Wallets', currencyHints: ['Provider/account eligible'], note: 'Availability is controlled by Flutterwave and the customer device/account.' },
  { key: 'enaira', label: 'eNaira', group: 'Wallets', currencyHints: ['NGN'] },
  { key: 'ussd', label: 'USSD', group: 'Others', currencyHints: ['NGN'] },
  { key: 'nqr', label: 'NQR', group: 'Others', currencyHints: ['NGN'] },
  { key: '1voucher', label: '1Voucher', group: 'Others', currencyHints: ['ZAR'] },
] as const;

export const MKETY_FLUTTERWAVE_PAYMENT_METHOD_GROUPS = [
  'Cards',
  'Bank Transfer',
  'Mobile Money',
  'Banks',
  'Wallets',
  'Others',
] as const;

export function getMketyFlutterwaveMethodLabelsForCurrency(currency: string): string[] {
  const normalized = currency.trim().toUpperCase();
  return MKETY_FLUTTERWAVE_PAYMENT_METHODS
    .filter((method) =>
      method.currencyHints.includes('Global') ||
      method.currencyHints.includes('Provider/account eligible') ||
      method.currencyHints.includes(normalized),
    )
    .map((method) => method.label);
}

export type EnterprisePaymentProvider = 'nowpayments' | 'selar';

export interface EnterpriseCheckoutRequest {
  customer: {
    fullName: string;
    companyName: string;
    email: string;
    phone?: string;
    country?: string;
  };
  project: {
    scopeId?: string;
    name: string;
    description?: string;
  };
  amountMinor: bigint;
  currency: 'USD';
  provider: EnterprisePaymentProvider;
}

export interface EnterpriseCheckoutResult {
  orderId: string;
  provider: EnterprisePaymentProvider;
  redirectUrl: string;
  status: 'checkout_created' | 'awaiting_confirmation';
}

const MIN_AMOUNT_MINOR = 1000n;
const MAX_AMOUNT_MINOR = 100000000n;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function requiredString(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== 'string') throw new Error(`${field} is required.`);
  const normalized = value.trim();
  if (normalized.length < 2 || normalized.length > maxLength) {
    throw new Error(`${field} is invalid.`);
  }
  return normalized;
}

function optionalString(value: unknown, maxLength: number): string | undefined {
  if (value == null || value === '') return undefined;
  if (typeof value !== 'string') throw new Error('Optional field is invalid.');
  const normalized = value.trim();
  if (!normalized) return undefined;
  if (normalized.length > maxLength) throw new Error('Optional field is too long.');
  return normalized;
}

export function parseUsdAmountToMinorUnits(value: unknown): bigint {
  if (typeof value !== 'string' && typeof value !== 'number') {
    throw new Error('Amount is required.');
  }
  const raw = String(value).trim();
  const match = /^(\d{1,7})(?:\.(\d{1,2}))?$/.exec(raw);
  if (!match) throw new Error('Amount must be a USD decimal value with at most two decimal places.');

  const dollars = BigInt(match[1]);
  const cents = BigInt((match[2] ?? '').padEnd(2, '0'));
  const amountMinor = dollars * 100n + cents;

  if (amountMinor < MIN_AMOUNT_MINOR || amountMinor > MAX_AMOUNT_MINOR) {
    throw new Error('Amount must be between $10.00 and $1,000,000.00.');
  }

  return amountMinor;
}

export function parseEnterpriseCheckoutInput(input: unknown): EnterpriseCheckoutRequest {
  if (!input || typeof input !== 'object') throw new Error('Checkout request is invalid.');
  const body = input as Record<string, unknown>;

  const fullName = requiredString(body.fullName, 'Full name', 120);
  const companyName = requiredString(body.companyName, 'Company name', 160);
  const email = requiredString(body.email, 'Email', 254).toLowerCase();
  if (!EMAIL_PATTERN.test(email)) throw new Error('Email is invalid.');

  const projectName = requiredString(body.projectName, 'Project name', 180);
  const provider = body.provider;
  if (provider !== 'nowpayments' && provider !== 'selar') throw new Error('Payment provider is not supported.');
  if (body.currency !== 'USD') throw new Error('Only USD is supported for enterprise checkout.');

  return {
    customer: {
      fullName,
      companyName,
      email,
      phone: optionalString(body.phone, 50),
      country: optionalString(body.country, 120),
    },
    project: {
      scopeId: optionalString(body.scopeId, 80),
      name: projectName,
      description: optionalString(body.projectDescription, 5000),
    },
    amountMinor: parseUsdAmountToMinorUnits(body.amount),
    currency: 'USD',
    provider,
  };
}

export function formatUsdMinorUnits(amountMinor: bigint): string {
  const dollars = amountMinor / 100n;
  const cents = amountMinor % 100n;
  return `${dollars}.${cents.toString().padStart(2, '0')}`;
}

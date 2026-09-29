import type {
  DomainQuote,
  DomainRegistrationContact,
  DomainResellerAdapter,
  RegisteredDomain,
} from './reseller';

type DomainNameApiEnvironment = 'ote' | 'production';

export interface DomainNameApiConfig {
  resellerId: string;
  apiKey: string;
  environment?: DomainNameApiEnvironment;
  baseUrl?: string;
  nameServers?: string[];
  whoisPrivacy?: boolean;
  relayUrl?: string;
  relaySecret?: string;
  relaySecretSeed?: string;
}

function normalizeDomain(value: string) {
  const domain = value.trim().toLowerCase().replace(/\.$/, '');
  if (!/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain)) {
    throw new Error('DomainNameAPI requires a valid fully-qualified domain name.');
  }
  return domain;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function findValue(value: unknown, keys: string[]): unknown {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findValue(item, keys);
      if (found !== undefined) return found;
    }
    return undefined;
  }
  const record = asRecord(value);
  if (!record) return undefined;
  for (const key of keys) {
    const actual = Object.keys(record).find((candidate) => candidate.toLowerCase() === key.toLowerCase());
    if (actual && record[actual] !== undefined) return record[actual];
  }
  for (const child of Object.values(record)) {
    const found = findValue(child, keys);
    if (found !== undefined) return found;
  }
  return undefined;
}

function parseMoneyMinor(value: unknown) {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return null;
  return BigInt(Math.round(numeric * 100));
}

function parseDate(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function successStatus(value: unknown) {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return null;
  const normalized = value.toLowerCase().replace(/[\s_-]/g, '');
  if (['success', 'available', 'ok', 'active', 'true'].includes(normalized)) return true;
  if (['error', 'notavailable', 'unavailable', 'failed', 'false'].includes(normalized)) return false;
  return null;
}

function providerContact(contact: DomainRegistrationContact, contactType: 'Registrant' | 'Admin' | 'Tech' | 'Billing') {
  const required = [
    contact.firstName,
    contact.lastName,
    contact.email,
    contact.address,
    contact.city,
    contact.state,
    contact.country,
    contact.postalCode,
    contact.phoneCountryCode,
    contact.phone,
  ];
  if (required.some((value) => !value?.trim())) {
    throw new Error('DomainNameAPI registration requires complete registrant contact details.');
  }
  if (!/^[A-Za-z]{2}$/.test(contact.country.trim())) {
    throw new Error('DomainNameAPI contact country must be a 2-character ISO code.');
  }
  return {
    contactType,
    firstName: contact.firstName.trim(),
    lastName: contact.lastName.trim(),
    companyName: contact.companyName?.trim() ?? '',
    eMail: contact.email.trim(),
    address: contact.address.trim(),
    city: contact.city.trim(),
    state: contact.state.trim(),
    country: contact.country.trim().toUpperCase(),
    postalCode: contact.postalCode.trim(),
    phoneCountryCode: contact.phoneCountryCode.replace(/\D/g, ''),
    phone: contact.phone.replace(/\D/g, ''),
    faxCountryCode: contact.faxCountryCode?.replace(/\D/g, '') ?? '',
    fax: contact.fax?.replace(/\D/g, '') ?? '',
    isHidden: false,
  };
}

export class DomainNameApiAdapter implements DomainResellerAdapter {
  private readonly baseUrl: string;
  private readonly relayUrl: string | null;
  private readonly relaySecret: string | null;
  private readonly relaySecretSeed: string | null;

  constructor(private readonly config: DomainNameApiConfig) {
    const environment = config.environment ?? 'ote';
    this.baseUrl = (config.baseUrl
      ?? (environment === 'production'
        ? 'https://api.domainresellerapi.com/api/v1'
        : 'https://ote.domainresellerapi.com/api/v1')).replace(/\/+$/, '');
    if (!config.resellerId.trim() || !config.apiKey.trim()) {
      throw new Error('DomainNameAPI Reseller ID and API Key are required.');
    }
    this.relayUrl = config.relayUrl?.trim().replace(/\/+$/, '') || null;
    this.relaySecret = config.relaySecret?.trim() || null;
    this.relaySecretSeed = config.relaySecretSeed?.trim() || null;
    const hasRelayKey = Boolean(this.relaySecret || this.relaySecretSeed);
    if ((this.relayUrl && !hasRelayKey) || (!this.relayUrl && hasRelayKey)) {
      throw new Error('DomainNameAPI relay URL and relay key material must be configured together.');
    }
    if (this.relaySecret && this.relaySecret.length < 32) {
      throw new Error('DomainNameAPI relay secret must be at least 32 characters.');
    }
    if (this.relaySecretSeed && this.relaySecretSeed.length < 32) {
      throw new Error('DomainNameAPI relay key seed must be at least 32 characters.');
    }
  }

  private async resolveRelaySecret() {
    if (this.relaySecret) return this.relaySecret;
    if (!this.relaySecretSeed) throw new Error('DomainNameAPI relay key material is not configured.');
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(this.relaySecretSeed),
      'HKDF',
      false,
      ['deriveBits'],
    );
    const bits = new Uint8Array(await crypto.subtle.deriveBits({
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new TextEncoder().encode('mkety-domain-relay-v1'),
      info: new TextEncoder().encode('request-hmac'),
    }, key, 256));
    return Array.from(bits, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  private async relayRequest(operation: 'quote' | 'register' | 'renew', payload: Record<string, unknown>) {
    if (!this.relayUrl) throw new Error('DomainNameAPI relay is not configured.');
    const relaySecret = await this.resolveRelaySecret();
    const timestamp = String(Date.now());
    const raw = JSON.stringify({
      nonce: crypto.randomUUID(),
      operation,
      environment: this.config.environment ?? 'ote',
      payload: {
        resellerId: this.config.resellerId.trim(),
        apiKey: this.config.apiKey.trim(),
        ...payload,
      },
    });
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(relaySecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const signatureBytes = new Uint8Array(await crypto.subtle.sign(
      'HMAC',
      key,
      new TextEncoder().encode(`${timestamp}.${raw}`),
    ));
    const signature = Array.from(signatureBytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    const response = await fetch(`${this.relayUrl}/v1/domainnameapi`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Mkety-Timestamp': timestamp,
        'X-Mkety-Signature': signature,
      },
      body: raw,
    });
    let body: unknown = null;
    try { body = await response.json(); } catch { body = null; }
    return { response, payload: body };
  }

  private async providerRequest(path: string, method: 'GET' | 'POST', body?: unknown) {
    const response = await fetch(`${this.baseUrl}/${path.replace(/^\/+/, '')}`, {
      method,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-API-KEY': this.config.apiKey.trim(),
        __reseller: this.config.resellerId.trim(),
      },
      ...(method === 'POST' ? { body: JSON.stringify(body ?? {}) } : {}),
    });
    let payload: unknown = null;
    try { payload = await response.json(); } catch { payload = null; }
    return { response, payload };
  }

  private async execute(operation: 'quote' | 'register' | 'renew', path: string, body: Record<string, unknown>) {
    const result = this.relayUrl
      ? await this.relayRequest(operation, body)
      : await this.providerRequest(path, 'POST', operation === 'quote' ? [{ domainName: body.domainName }] : body);
    if (result.response.ok) return result.payload;
    const message = findValue(result.payload, ['message', 'errorMessage', 'error', 'detail']);
    throw new Error(
      `DomainNameAPI ${operation} failed (${result.response.status})${typeof message === 'string' ? `: ${message}` : ''}.`,
    );
  }

  async quote(domainValue: string, years = 1): Promise<DomainQuote> {
    const domain = normalizeDomain(domainValue);
    const payload = await this.execute('quote', 'domains/bulk-search', { domainName: domain, period: years });
    const items = Array.isArray(payload)
      ? payload
      : (asRecord(payload)?.infos as unknown[] | undefined) ?? [];
    const item = items.find((entry) => String(findValue(entry, ['domainName']) ?? '').toLowerCase() === domain)
      ?? items[0]
      ?? payload;

    const status = findValue(item, ['status', 'available', 'isAvailable']);
    const available = typeof status === 'boolean' ? status : successStatus(status) ?? false;
    return {
      domain,
      available,
      registrationPriceMinor: parseMoneyMinor(findValue(item, ['price', 'registrationPrice', 'registerPrice'])),
      renewalPriceMinor: parseMoneyMinor(findValue(item, ['renewalPrice', 'renewPrice'])),
      currency: String(findValue(item, ['currency', 'currencyCode']) ?? 'USD').toUpperCase(),
      providerQuoteRef: String(findValue(item, ['quoteId', 'requestId']) ?? '') || null,
    };
  }

  async register(input: {
    domain: string;
    years: number;
    idempotencyKey: string;
    contact: DomainRegistrationContact;
  }): Promise<RegisteredDomain> {
    const domain = normalizeDomain(input.domain);
    void input.idempotencyKey;
    const contacts = (['Registrant', 'Admin', 'Tech', 'Billing'] as const)
      .map((type) => providerContact(input.contact, type));
    const payload = await this.execute('register', 'domains/register-with-contacts', {
      domainName: domain,
      period: input.years,
      nameServers: this.config.nameServers?.length
        ? this.config.nameServers
        : ['tr.apiname.com', 'eu.apiname.com'],
      isLocked: true,
      privacyEnabled: this.config.whoisPrivacy ?? true,
      contacts,
      tldAttributes: {},
    });
    const status = successStatus(findValue(payload, ['status', 'success']));
    if (status === false) throw new Error('DomainNameAPI did not confirm domain registration.');
    return {
      domain,
      expiresAt: parseDate(findValue(payload, ['expirationDate', 'expiryDate', 'expiresAt'])),
      providerDomainRef: String(findValue(payload, ['domainName']) ?? domain),
    };
  }

  async renew(input: {
    providerDomainRef: string;
    years: number;
    idempotencyKey: string;
  }): Promise<RegisteredDomain> {
    const domain = normalizeDomain(input.providerDomainRef);
    void input.idempotencyKey;
    const payload = await this.execute('renew', 'domains/renew', {
      domainName: domain,
      period: input.years,
    });
    const status = successStatus(findValue(payload, ['status', 'success']));
    if (status === false) throw new Error('DomainNameAPI did not confirm domain renewal.');
    return {
      domain,
      expiresAt: parseDate(findValue(payload, ['expirationDate', 'expiryDate', 'expiresAt'])),
      providerDomainRef: String(findValue(payload, ['domainName']) ?? domain),
    };
  }
}

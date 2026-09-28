import type { DomainQuote, DomainResellerAdapter, RegisteredDomain } from './reseller';

type DomainNameApiEnvironment = 'ote' | 'production';

export interface DomainNameApiConfig {
  username: string;
  apiToken: string;
  environment?: DomainNameApiEnvironment;
  baseUrl?: string;
  nameServers?: string[];
  whoisPrivacy?: boolean;
}

function normalizeDomain(value: string) {
  const domain = value.trim().toLowerCase().replace(/\.$/, '');
  if (!/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain)) {
    throw new Error('DomainNameAPI requires a valid fully-qualified domain name.');
  }
  return domain;
}

function splitDomain(domain: string) {
  const labels = domain.split('.');
  if (labels.length < 2) throw new Error('Domain name must include an extension.');
  return { name: labels.slice(0, -1).join('.'), tld: labels.at(-1)! };
}

function base64(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
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

export class DomainNameApiAdapter implements DomainResellerAdapter {
  private readonly baseUrl: string;
  private readonly auth: string;

  constructor(private readonly config: DomainNameApiConfig) {
    const environment = config.environment ?? 'ote';
    this.baseUrl = (config.baseUrl
      ?? (environment === 'production'
        ? 'https://api.domainresellerapi.com'
        : 'https://ote.domainresellerapi.com')).replace(/\/+$/, '');
    if (!config.username.trim() || !config.apiToken.trim()) {
      throw new Error('DomainNameAPI username and API token are required.');
    }
    this.auth = `Basic ${base64(`${config.username.trim()}:${config.apiToken.trim()}`)}`;
  }

  private async request(path: string, init: RequestInit) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: this.auth,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...init.headers,
      },
    });
    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    return { response, payload };
  }

  private async mutation(paths: string[], body: Record<string, unknown>) {
    let lastStatus = 0;
    let lastPayload: unknown = null;
    for (const path of paths) {
      const legacyBody = path.startsWith('/v1/domain/')
        ? {
            ...body,
            resellerId: this.config.username.trim(),
            apiKey: this.config.apiToken.trim(),
          }
        : body;
      const { response, payload } = await this.request(path, {
        method: 'POST',
        body: JSON.stringify(legacyBody),
      });
      lastStatus = response.status;
      lastPayload = payload;
      if (response.ok) return payload;
      // Endpoint-shape fallback is safe only when the attempted route does not exist.
      if (response.status !== 404 && response.status !== 405) break;
    }
    const message = findValue(lastPayload, ['message', 'errorMessage', 'error', 'detail']);
    throw new Error(`DomainNameAPI request failed (${lastStatus})${typeof message === 'string' ? `: ${message}` : ''}.`);
  }

  async quote(domainValue: string, years = 1): Promise<DomainQuote> {
    const domain = normalizeDomain(domainValue);
    const { name, tld } = splitDomain(domain);

    let payload: unknown;
    const modern = await this.request('/api/v1/domains/search', {
      method: 'POST',
      body: JSON.stringify({ domainName: domain, period: years, command: 'create' }),
    });
    if (modern.response.ok) {
      payload = modern.payload;
    } else if (modern.response.status === 404 || modern.response.status === 405) {
      const params = new URLSearchParams({
        domainNames: name,
        tlds: tld,
        period: String(years),
        command: 'create',
      });
      const fallback = await this.request(`/api/domain/check?${params.toString()}`, { method: 'GET' });
      if (!fallback.response.ok) {
        throw new Error(`DomainNameAPI availability check failed (${fallback.response.status}).`);
      }
      payload = fallback.payload;
    } else {
      throw new Error(`DomainNameAPI availability check failed (${modern.response.status}).`);
    }

    const status = findValue(payload, ['status', 'available', 'isAvailable']);
    const available = typeof status === 'boolean' ? status : successStatus(status) ?? false;
    const registration = findValue(payload, ['registrationPrice', 'registerPrice', 'price', 'createPrice']);
    const renewal = findValue(payload, ['renewalPrice', 'renewPrice']);
    const currency = String(findValue(payload, ['currency', 'currencyCode']) ?? 'USD').toUpperCase();

    return {
      domain,
      available,
      registrationPriceMinor: parseMoneyMinor(registration),
      renewalPriceMinor: parseMoneyMinor(renewal),
      currency,
      providerQuoteRef: String(findValue(payload, ['quoteId', 'orderId', 'requestId']) ?? '') || null,
    };
  }

  async register(input: {
    domain: string;
    years: number;
    idempotencyKey: string;
    contactRef: string;
  }): Promise<RegisteredDomain> {
    const domain = normalizeDomain(input.domain);
    void input.idempotencyKey; // Mkety owns idempotency; DomainNameAPI does not document a stable idempotency header.
    const payload = await this.mutation(
      ['/api/v1/domains/register', '/v1/domain/register'],
      {
        domainName: domain,
        period: input.years,
        registrantContactId: input.contactRef,
        nameServers: this.config.nameServers?.length
          ? this.config.nameServers
          : ['tr.apiname.com', 'eu.apiname.com'],
        whoisPrivacy: this.config.whoisPrivacy ?? true,
      },
    );

    const status = successStatus(findValue(payload, ['status', 'success']));
    if (status === false) {
      throw new Error('DomainNameAPI did not confirm domain registration.');
    }
    return {
      domain,
      expiresAt: parseDate(findValue(payload, ['expiryDate', 'expiresAt', 'expirationDate'])),
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
    const payload = await this.mutation(
      ['/api/v1/domains/renew', '/v1/domain/renew'],
      { domainName: domain, period: input.years },
    );
    const status = successStatus(findValue(payload, ['status', 'success']));
    if (status === false) throw new Error('DomainNameAPI did not confirm domain renewal.');
    return {
      domain,
      expiresAt: parseDate(findValue(payload, ['expiryDate', 'expiresAt', 'expirationDate'])),
      providerDomainRef: String(findValue(payload, ['domainName']) ?? domain),
    };
  }
}

export function createDomainNameApiAdapterFromEnvironment(environment: NodeJS.ProcessEnv = process.env) {
  const username = environment.DOMAINNAMEAPI_USERNAME?.trim();
  const apiToken = environment.DOMAINNAMEAPI_API_TOKEN?.trim();
  if (!username || !apiToken) return null;

  const mode = environment.DOMAINNAMEAPI_ENVIRONMENT === 'production' ? 'production' : 'ote';
  const nameServers = (environment.DOMAINNAMEAPI_NAMESERVERS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  return new DomainNameApiAdapter({
    username,
    apiToken,
    environment: mode,
    baseUrl: environment.DOMAINNAMEAPI_BASE_URL?.trim() || undefined,
    nameServers,
    whoisPrivacy: environment.DOMAINNAMEAPI_WHOIS_PRIVACY !== 'false',
  });
}

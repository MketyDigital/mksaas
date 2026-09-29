import type { DomainQuote, DomainResellerAdapter, RegisteredDomain } from './reseller';

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
  private readonly legacyAuth: string;
  private readonly relayUrl: string | null;
  private readonly relaySecret: string | null;

  constructor(private readonly config: DomainNameApiConfig) {
    const environment = config.environment ?? 'ote';
    this.baseUrl = (config.baseUrl
      ?? (environment === 'production'
        ? 'https://api.domainresellerapi.com'
        : 'https://ote.domainresellerapi.com')).replace(/\/+$/, '');
    if (!config.resellerId.trim() || !config.apiKey.trim()) {
      throw new Error('DomainNameAPI Reseller ID and API Key are required.');
    }
    if (!/^\d+$/.test(config.resellerId.trim())) {
      throw new Error('DomainNameAPI V2 requires the numerical Reseller ID from Integration Details, not the reseller-panel username.');
    }
    this.legacyAuth = `Basic ${base64(`${config.resellerId.trim()}:${config.apiKey.trim()}`)}`;
    this.relayUrl = config.relayUrl?.trim().replace(/\/+$/, '') || null;
    this.relaySecret = config.relaySecret?.trim() || null;
    if ((this.relayUrl && !this.relaySecret) || (!this.relayUrl && this.relaySecret)) {
      throw new Error('DomainNameAPI relay URL and secret must be configured together.');
    }
    if (this.relaySecret && this.relaySecret.length < 32) {
      throw new Error('DomainNameAPI relay secret must be at least 32 characters.');
    }
  }

  private async relayRequest(operation: 'quote' | 'register' | 'renew', body: string) {
    if (!this.relayUrl || !this.relaySecret) throw new Error('DomainNameAPI relay is not configured.');
    const timestamp = String(Date.now());
    const nonce = crypto.randomUUID();
    const raw = JSON.stringify({
      nonce,
      operation,
      environment: this.config.environment ?? 'ote',
      payload: JSON.parse(body) as Record<string, unknown>,
    });
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(this.relaySecret),
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
    let payload: unknown = null;
    try { payload = await response.json(); } catch { payload = null; }
    return { response, payload };
  }

  private async request(path: string, init: RequestInit, authMode: 'v2' | 'legacy-basic' = 'v2') {
    if (this.relayUrl && authMode === 'v2') {
      const operation = path === '/v1/domain/check'
        ? 'quote'
        : path === '/v1/domain/register'
          ? 'register'
          : path === '/v1/domain/renew'
            ? 'renew'
            : null;
      if (!operation) throw new Error('DomainNameAPI relay refuses unsupported endpoint fallback.');
      return this.relayRequest(operation, String(init.body ?? '{}'));
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        ...(authMode === 'legacy-basic' ? { Authorization: this.legacyAuth } : {}),
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
            resellerId: this.config.resellerId.trim(),
            apiKey: this.config.apiKey.trim(),
          }
        : body;
      const { response, payload } = await this.request(path, {
        method: 'POST',
        body: JSON.stringify(legacyBody),
      });
      lastStatus = response.status;
      lastPayload = payload;
      if (response.ok) return payload;
      if (this.relayUrl) break;
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
    // DomainNameAPI's current Swagger contract documents availability through
    // POST /v1/domain/check with the Reseller ID and API key in the request body.
    // Only fall back to alternate endpoint shapes when that route is genuinely absent;
    // authentication/authorization failures must remain visible and fail closed.
    const v1 = await this.request('/v1/domain/check', {
      method: 'POST',
      body: JSON.stringify({
        resellerId: this.config.resellerId.trim(),
        apiKey: this.config.apiKey.trim(),
        domainName: domain,
        period: years,
      }),
    });
    if (v1.response.ok) {
      payload = v1.payload;
    } else if (!this.relayUrl && (v1.response.status === 404 || v1.response.status === 405)) {
      const params = new URLSearchParams({
        domainNames: name,
        tlds: tld,
        period: String(years),
        command: 'create',
      });
      const legacyBasic = await this.request(`/api/domain/check?${params.toString()}`, { method: 'GET' }, 'legacy-basic');
      if (legacyBasic.response.ok) {
        payload = legacyBasic.payload;
      } else if (legacyBasic.response.status === 404 || legacyBasic.response.status === 405) {
        const modern = await this.request('/api/v1/domains/search', {
          method: 'POST',
          body: JSON.stringify({ domainName: domain, period: years, command: 'create' }),
        });
        if (!modern.response.ok) {
          throw new Error(`DomainNameAPI availability check failed (${modern.response.status}).`);
        }
        payload = modern.payload;
      } else {
        throw new Error(`DomainNameAPI availability check failed (${legacyBasic.response.status}).`);
      }
    } else {
      throw new Error(`DomainNameAPI availability check failed (${v1.response.status}).`);
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
      ['/v1/domain/register', '/api/v1/domains/register'],
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

    let currentExpiryDate: string | undefined;
    const info = await this.request(
      `/api/v1/domains/info?domainName=${encodeURIComponent(domain)}`,
      { method: 'GET' },
    );
    if (info.response.ok) {
      const value = findValue(info.payload, ['expiryDate', 'expiresAt', 'expirationDate']);
      if (typeof value === 'string' && value.trim()) currentExpiryDate = value.trim();
    }

    const payload = await this.mutation(
      ['/v1/domain/renew', '/api/v1/domains/renew'],
      {
        domainName: domain,
        period: input.years,
        ...(currentExpiryDate ? { currentExpiryDate } : {}),
      },
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


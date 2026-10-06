/** @jest-environment node */

import { env } from 'cloudflare:workers';

import {
  getFirstPartyMailTenantId,
  getMailGatewayInternalSecret,
  getMailInternalSecret,
  mailExternalClientsEnabled,
} from './runtime-config';

type TestBindings = {
  MKETY_FIRST_PARTY_MAIL_TENANT_ID?: string;
  MKETY_MAIL_INTERNAL_SECRET?: string;
  MKETY_MAIL_GATEWAY_INTERNAL_SECRET?: string;
  MKETY_MAIL_EXTERNAL_CLIENTS_ENABLED?: string;
};

const bindings = env as TestBindings;
const keys = [
  'MKETY_FIRST_PARTY_MAIL_TENANT_ID',
  'MKETY_MAIL_INTERNAL_SECRET',
  'MKETY_MAIL_GATEWAY_INTERNAL_SECRET',
  'MKETY_MAIL_EXTERNAL_CLIENTS_ENABLED',
] as const;

describe('Mail runtime configuration', () => {
  const originalProcessValues = new Map(keys.map((key) => [key, process.env[key]]));

  afterEach(() => {
    for (const key of keys) {
      delete bindings[key];
      const value = originalProcessValues.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('reads the first-party tenant ID from the Cloudflare runtime binding', () => {
    bindings.MKETY_FIRST_PARTY_MAIL_TENANT_ID = 'runtime-tenant';
    process.env.MKETY_FIRST_PARTY_MAIL_TENANT_ID = 'build-tenant';

    expect(getFirstPartyMailTenantId()).toBe('runtime-tenant');
  });

  it('reads the Mail internal secret from the Cloudflare runtime binding', () => {
    bindings.MKETY_MAIL_INTERNAL_SECRET = 'runtime-internal-secret';
    process.env.MKETY_MAIL_INTERNAL_SECRET = 'build-internal-secret';

    expect(getMailInternalSecret()).toBe('runtime-internal-secret');
  });

  it('reads the Mail gateway secret from the Cloudflare runtime binding', () => {
    bindings.MKETY_MAIL_GATEWAY_INTERNAL_SECRET = 'runtime-gateway-secret';
    process.env.MKETY_MAIL_GATEWAY_INTERNAL_SECRET = 'build-gateway-secret';

    expect(getMailGatewayInternalSecret()).toBe('runtime-gateway-secret');
  });

  it('keeps external Mail clients disabled when the runtime binding is false', () => {
    bindings.MKETY_MAIL_EXTERNAL_CLIENTS_ENABLED = 'false';
    process.env.MKETY_MAIL_EXTERNAL_CLIENTS_ENABLED = 'true';

    expect(mailExternalClientsEnabled()).toBe(false);
  });

  it('falls back to process.env when running without a Cloudflare binding', () => {
    process.env.MKETY_FIRST_PARTY_MAIL_TENANT_ID = 'local-tenant';

    expect(getFirstPartyMailTenantId()).toBe('local-tenant');
  });

  it('does not fall back to a stale process value when a binding is explicitly empty', () => {
    bindings.MKETY_FIRST_PARTY_MAIL_TENANT_ID = '';
    process.env.MKETY_FIRST_PARTY_MAIL_TENANT_ID = 'stale-build-tenant';

    expect(getFirstPartyMailTenantId()).toBe('');
  });
});

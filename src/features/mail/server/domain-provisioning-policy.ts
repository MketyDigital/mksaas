type DnsRecord = { type?: string; name?: string; content?: string };

export type MailDomainProvisioningPolicy = {
  allowed: boolean;
  configureRouting: boolean;
  configureSending: boolean;
};

function normalizeName(value: string) {
  return value.trim().toLowerCase().replace(/\.$/, '');
}

function normalizeContent(type: string, value: string) {
  const content = type.toUpperCase() === 'TXT' ? value.replaceAll('"', '').trim() : value.trim().replace(/\.$/, '').toLowerCase();
  return content.replace(/\s+/g, ' ');
}

export function isFirstPartyMailDomain(domain: string, tenantId: string, configuredTenantId: string) {
  return normalizeName(domain) === 'mail.mkety.com' &&
    Boolean(configuredTenantId.trim()) &&
    tenantId === configuredTenantId.trim();
}

export function getMailDomainProvisioningPolicy(domain: string, isFirstPartyTenant = false): MailDomainProvisioningPolicy {
  const normalized = normalizeName(domain);
  if (normalized === 'mkety.com') {
    return { allowed: false, configureRouting: false, configureSending: false };
  }

  if (normalized === 'mail.mkety.com') {
    return isFirstPartyTenant
      ? { allowed: true, configureRouting: false, configureSending: true }
      : { allowed: false, configureRouting: false, configureSending: false };
  }

  return { allowed: true, configureRouting: true, configureSending: true };
}

export function areCloudflareEmailAuthRecordsPublished(
  domain: string,
  sendingEnabled: boolean,
  expectedRecords: DnsRecord[],
  publishedRecords: DnsRecord[],
) {
  if (!sendingEnabled) return false;

  const normalizedDomain = normalizeName(domain);
  const expected = expectedRecords
    .filter((record): record is { type: string; name: string; content: string } =>
      Boolean(record.type && record.name && record.content),
    )
    .map((record) => ({
      type: record.type.toUpperCase(),
      name: normalizeName(record.name),
      content: normalizeContent(record.type, record.content),
    }));

  const spf = expected.find((record) =>
    record.type === 'TXT' &&
    record.name === normalizedDomain &&
    record.content.toLowerCase().startsWith('v=spf1'),
  );
  const dkim = expected.find((record) =>
    ['TXT', 'CNAME'].includes(record.type) &&
    record.name.includes('._domainkey.'),
  );
  const dmarc = expected.find((record) =>
    record.type === 'TXT' &&
    record.name === `_dmarc.${normalizedDomain}` &&
    record.content.toLowerCase().startsWith('v=dmarc1'),
  );
  if (!spf || !dkim || !dmarc) return false;

  const published = publishedRecords
    .filter((record): record is { type: string; name: string; content: string } =>
      Boolean(record.type && record.name && record.content),
    )
    .map((record) => ({
      type: record.type.toUpperCase(),
      name: normalizeName(record.name),
      content: normalizeContent(record.type, record.content),
    }));

  return [spf, dkim, dmarc].every((required) =>
    published.some((actual) =>
      actual.type === required.type &&
      actual.name === required.name &&
      actual.content === required.content,
    ),
  );
}

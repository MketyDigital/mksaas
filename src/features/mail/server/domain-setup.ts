import type { getMailDomainProvisioningPolicy } from './domain-provisioning-policy';

type ProvisioningPolicy = ReturnType<typeof getMailDomainProvisioningPolicy>;

type CloudflareDomainSetup = {
  findZone(domain: string): Promise<{ id: string; name: string } | null>;
  getRouting(zoneId: string): Promise<Record<string, unknown> | null>;
  enableRouting(zoneId: string, domain: string): Promise<unknown>;
  getSending(zoneId: string, domain: string): Promise<Record<string, unknown> | null>;
  enableSending(zoneId: string, domain: string): Promise<Record<string, unknown> | null>;
  getSendingDns(zoneId: string, senderId: string): Promise<Array<{ type?: string; name?: string; content?: string }>>;
  getPublicSendingDns(records: Array<{ type?: string; name?: string; content?: string }>, domain: string): Promise<Array<{ type?: string; name?: string; content?: string }>>;
  ensureEventSubscription(zoneId: string, domain: string): Promise<unknown>;
  verifyAuthRecords(domain: string, enabled: boolean, expected: Array<{ type?: string; name?: string; content?: string }>, published: Array<{ type?: string; name?: string; content?: string }>): boolean;
};

export type MailDomainProvisioningResult = {
  zoneId: string | null;
  routingEnabled: boolean;
  sendingEnabled: boolean;
  sendingAuthVerified: boolean;
  failed: boolean;
};

export async function provisionMailDomain(
  domain: string,
  policy: ProvisioningPolicy,
  cloudflare: CloudflareDomainSetup,
  initial: Partial<MailDomainProvisioningResult> = {},
): Promise<MailDomainProvisioningResult> {
  const result: MailDomainProvisioningResult = {
    zoneId: initial.zoneId ?? null,
    routingEnabled: initial.routingEnabled ?? false,
    sendingEnabled: initial.sendingEnabled ?? false,
    sendingAuthVerified: initial.sendingAuthVerified ?? false,
    failed: false,
  };

  try {
    const zone = await cloudflare.findZone(domain);
    if (!zone) return result;
    result.zoneId = zone.id;

    if (policy.configureRouting) {
      const existingRouting = await cloudflare.getRouting(zone.id);
      if (!existingRouting?.enabled) await cloudflare.enableRouting(zone.id, domain);
      const routing = existingRouting?.enabled ? existingRouting : await cloudflare.getRouting(zone.id);
      result.routingEnabled = Boolean(routing?.enabled);
    }

    if (policy.configureSending) {
      const configuredSending = await cloudflare.getSending(zone.id, domain);
      const sending = configuredSending || await cloudflare.enableSending(zone.id, domain);
      result.sendingEnabled = Boolean(sending?.enabled);
      if (result.sendingEnabled && typeof sending?.tag === 'string') {
        const expectedRecords = await cloudflare.getSendingDns(zone.id, sending.tag);
        const publicRecords = await cloudflare.getPublicSendingDns(expectedRecords, domain);
        result.sendingAuthVerified = cloudflare.verifyAuthRecords(domain, result.sendingEnabled, expectedRecords, publicRecords);
      }
      if (result.sendingEnabled) await cloudflare.ensureEventSubscription(zone.id, domain);
    }
  } catch {
    result.failed = true;
  }

  return result;
}

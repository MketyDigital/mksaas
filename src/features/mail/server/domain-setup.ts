import type { getMailDomainProvisioningPolicy } from './domain-provisioning-policy';

type ProvisioningPolicy = ReturnType<typeof getMailDomainProvisioningPolicy>;

type CloudflareDomainSetup = {
  findZone(domain: string): Promise<{ id: string; name: string } | null>;
  getRouting(zoneId: string): Promise<Record<string, unknown> | null>;
  enableRouting(zoneId: string, domain: string): Promise<unknown>;
  getSending(zoneId: string, domain: string): Promise<Record<string, unknown> | null>;
  enableSending(zoneId: string, domain: string): Promise<Record<string, unknown> | null>;
  getSendingDns(zoneId: string, senderId: string): Promise<Array<{ type?: string; name?: string; content?: string }>>;
  ensureSendingDns(zoneId: string, domain: string, records: Array<{ type?: string; name?: string; content?: string; priority?: number }>): Promise<void>;
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

  let stage = 'find_zone';
  try {
    const zone = await cloudflare.findZone(domain);
    if (!zone) return result;
    result.zoneId = zone.id;

    if (policy.configureRouting) {
      stage = 'check_email_routing';
      const existingRouting = await cloudflare.getRouting(zone.id);
      if (!existingRouting?.enabled) {
        stage = 'enable_email_routing';
        await cloudflare.enableRouting(zone.id, domain);
      }
      stage = 'verify_email_routing';
      const routing = existingRouting?.enabled ? existingRouting : await cloudflare.getRouting(zone.id);
      result.routingEnabled = Boolean(routing?.enabled);
    }

    if (policy.configureSending) {
      stage = 'check_email_sending';
      const configuredSending = await cloudflare.getSending(zone.id, domain);
      stage = 'enable_email_sending';
      const sending = configuredSending || await cloudflare.enableSending(zone.id, domain);
      result.sendingEnabled = Boolean(sending?.enabled);
      if (result.sendingEnabled && typeof sending?.tag === 'string') {
        stage = 'read_sending_dns';
        const expectedRecords = await cloudflare.getSendingDns(zone.id, sending.tag);
        stage = 'ensure_sending_dns';
        await cloudflare.ensureSendingDns(zone.id, domain, expectedRecords);
        stage = 'verify_sending_dns';
        const publicRecords = await cloudflare.getPublicSendingDns(expectedRecords, domain);
        result.sendingAuthVerified = cloudflare.verifyAuthRecords(domain, result.sendingEnabled, expectedRecords, publicRecords);
      }
      if (result.sendingEnabled) {
        stage = 'ensure_sending_events';
        await cloudflare.ensureEventSubscription(zone.id, domain);
      }
    }
  } catch (error) {
    const details=error&&typeof error==='object'?error as {name?:unknown;httpStatus?:unknown;providerCode?:unknown;message?:unknown}:{};
    const safeMessage=typeof details.message==='string'&&/^mail_[a-z0-9_]+$/.test(details.message)?details.message:undefined;
    console.error('[mail-domain-setup] provisioning failed',{
      domain,
      stage,
      errorName:typeof details.name==='string'?details.name:'Error',
      ...(typeof details.httpStatus==='number'?{httpStatus:details.httpStatus}:{}),
      ...(typeof details.providerCode==='number'?{providerCode:details.providerCode}:{}),
      ...(safeMessage?{safeErrorCode:safeMessage}:{}),
    });
    result.failed = true;
  }

  return result;
}

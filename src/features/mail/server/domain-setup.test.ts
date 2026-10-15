import { provisionMailDomain } from './domain-setup';

describe('Mail domain setup retry', () => {
  const cloudflare = {
    findZone: jest.fn(),
    getRouting: jest.fn(),
    enableRouting: jest.fn(),
    getSending: jest.fn(),
    enableSending: jest.fn(),
    getSendingDns: jest.fn(),
    ensureSendingDns: jest.fn(),
    getPublicSendingDns: jest.fn(),
    ensureEventSubscription: jest.fn(),
    verifyAuthRecords: jest.fn(),
  };

  beforeEach(() => {
    jest.resetAllMocks();
    cloudflare.findZone.mockResolvedValue({ id: 'zone-id', name: 'mkety.com' });
    cloudflare.getRouting.mockResolvedValue({ enabled: true });
    cloudflare.getSending.mockResolvedValue({ enabled: true, tag: 'sender-id' });
    cloudflare.getSendingDns.mockResolvedValue([]);
    cloudflare.ensureSendingDns.mockResolvedValue(undefined);
    cloudflare.getPublicSendingDns.mockResolvedValue([]);
    cloudflare.ensureEventSubscription.mockResolvedValue(null);
    cloudflare.verifyAuthRecords.mockReturnValue(false);
  });

  it('keeps the first-party root domain sending-only when retried', async () => {
    const result = await provisionMailDomain('mkety.com', {
      allowed: true,
      configureRouting: false,
      configureSending: true,
    }, cloudflare);

    expect(cloudflare.enableRouting).not.toHaveBeenCalled();
    expect(cloudflare.ensureSendingDns).toHaveBeenCalledWith('zone-id', 'mkety.com', []);
    expect(result).toMatchObject({ zoneId: 'zone-id', routingEnabled: false, sendingEnabled: true });
  });

  it('logs a safe stage and provider code when sending DNS provisioning fails', async () => {
    const log=jest.spyOn(console,'error').mockImplementation(() => undefined);
    cloudflare.getSendingDns.mockResolvedValue([{type:'TXT',name:'cf-bounce.mkety.com',content:'v=spf1 test'}]);
    cloudflare.ensureSendingDns.mockRejectedValue(Object.assign(new Error('mail_sending_dns_conflict'),{
      name:'CloudflareApiError',httpStatus:403,providerCode:10000,
    }));

    const result=await provisionMailDomain('mkety.com',{
      allowed:true,configureRouting:false,configureSending:true,
    },cloudflare);

    expect(result).toMatchObject({sendingEnabled:true,failed:true});
    expect(log).toHaveBeenCalledWith('[mail-domain-setup] provisioning failed',expect.objectContaining({
      domain:'mkety.com',stage:'ensure_sending_dns',errorName:'CloudflareApiError',httpStatus:403,providerCode:10000,
      safeErrorCode:'mail_sending_dns_conflict',
    }));
    log.mockRestore();
  });

  it('does not enable an already configured routing zone again', async () => {
    cloudflare.getRouting.mockResolvedValue({ enabled: true });

    const result = await provisionMailDomain('mail.mkety.com', {
      allowed: true,
      configureRouting: true,
      configureSending: false,
    }, cloudflare);

    expect(cloudflare.enableRouting).not.toHaveBeenCalled();
    expect(result.routingEnabled).toBe(true);
  });

  it('returns a retryable failure when Cloudflare is unavailable', async () => {
    cloudflare.findZone.mockRejectedValue(new Error('token not configured'));

    const result = await provisionMailDomain('customer.example', {
      allowed: true,
      configureRouting: true,
      configureSending: true,
    }, cloudflare);

    expect(result).toMatchObject({ zoneId: null, routingEnabled: false, sendingEnabled: false, failed: true });
  });

  it('preserves verified setup when a later retry cannot reach Cloudflare', async () => {
    cloudflare.findZone.mockRejectedValue(new Error('temporary API error'));

    const result = await provisionMailDomain('customer.example', {
      allowed: true,
      configureRouting: true,
      configureSending: true,
    }, cloudflare, {
      zoneId: 'existing-zone',
      routingEnabled: true,
      sendingEnabled: true,
      sendingAuthVerified: true,
    });

    expect(result).toMatchObject({
      zoneId: 'existing-zone',
      routingEnabled: true,
      sendingEnabled: true,
      sendingAuthVerified: true,
      failed: true,
    });
  });
});

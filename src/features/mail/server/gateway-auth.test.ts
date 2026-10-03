import { isMailGatewayCredentialAllowed } from './gateway-auth';

describe('Mail gateway credential protocol authorization', () => {
  it('blocks existing customer credentials while external clients are disabled', () => {
    expect(isMailGatewayCredentialAllowed({
      protocolScope: 'all', protocol: 'smtp', isFirstPartyTenant: false, externalClientsEnabled: false,
    })).toBe(false);
  });

  it('permits only first-party SMTP credentials while external clients are disabled', () => {
    expect(isMailGatewayCredentialAllowed({
      protocolScope: 'smtp', protocol: 'smtp', isFirstPartyTenant: true, externalClientsEnabled: false,
    })).toBe(true);
    expect(isMailGatewayCredentialAllowed({
      protocolScope: 'smtp', protocol: 'imap', isFirstPartyTenant: true, externalClientsEnabled: false,
    })).toBe(false);
    expect(isMailGatewayCredentialAllowed({
      protocolScope: 'all', protocol: 'smtp', isFirstPartyTenant: true, externalClientsEnabled: false,
    })).toBe(false);
    expect(isMailGatewayCredentialAllowed({
      protocolScope: 'all', protocol: 'smtp', isFirstPartyTenant: true, externalClientsEnabled: true,
    })).toBe(false);
  });

  it('permits customer all-protocol credentials only when external clients are enabled', () => {
    expect(isMailGatewayCredentialAllowed({
      protocolScope: 'all', protocol: 'smtp', isFirstPartyTenant: false, externalClientsEnabled: true,
    })).toBe(true);
    expect(isMailGatewayCredentialAllowed({
      protocolScope: 'all', protocol: 'imap', isFirstPartyTenant: false, externalClientsEnabled: true,
    })).toBe(true);
    expect(isMailGatewayCredentialAllowed({
      protocolScope: 'smtp', protocol: 'imap', isFirstPartyTenant: false, externalClientsEnabled: true,
    })).toBe(false);
  });
});

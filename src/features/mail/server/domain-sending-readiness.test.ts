import { isMailSendingDomainReady } from './domain-sending-readiness';

const readyDomain = {
  status: 'sending_ready',
  sendingEnabled: true,
  spfStatus: 'verified',
  dkimStatus: 'verified',
  dmarcStatus: 'verified',
};

describe('isMailSendingDomainReady', () => {
  it('allows sending only after the domain and all sender authentication checks are ready', () => {
    expect(isMailSendingDomainReady(readyDomain)).toBe(true);
    expect(isMailSendingDomainReady({ ...readyDomain, status: 'ready' })).toBe(true);
    expect(isMailSendingDomainReady({ ...readyDomain, status: 'verified' })).toBe(true);
  });

  it.each(['spfStatus', 'dkimStatus', 'dmarcStatus'] as const)('blocks sending while %s is pending', (field) => {
    expect(isMailSendingDomainReady({ ...readyDomain, [field]: 'pending' })).toBe(false);
  });

  it('blocks sending if the provider toggle is on but the domain setup is pending', () => {
    expect(isMailSendingDomainReady({ ...readyDomain, status: 'pending' })).toBe(false);
  });

  it('blocks sending if the domain setup is complete but sending is disabled', () => {
    expect(isMailSendingDomainReady({ ...readyDomain, sendingEnabled: false })).toBe(false);
  });
});

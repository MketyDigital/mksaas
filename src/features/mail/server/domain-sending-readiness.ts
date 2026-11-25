export type MailSendingDomainReadiness = {
  status: string;
  sendingEnabled: boolean;
  spfStatus: string;
  dkimStatus: string;
  dmarcStatus: string;
};

/**
 * A queued message must have a fully authenticated sending domain.
 * Sending being toggled on alone does not mean recipient servers will accept it.
 */
export function isMailSendingDomainReady(domain: MailSendingDomainReadiness): boolean {
  return ['ready', 'sending_ready', 'verified'].includes(domain.status)
    && domain.sendingEnabled
    && domain.spfStatus === 'verified'
    && domain.dkimStatus === 'verified'
    && domain.dmarcStatus === 'verified';
}

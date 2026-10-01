export type DomainEvidence = {
  dnsOk: boolean;
  tlsOk: boolean;
  ownershipOk: boolean;
  providerStatus?: string | null;
  observedTarget?: string | null;
  checkedAt: number;
};

export function domainIsUsable(evidence: DomainEvidence) {
  return evidence.dnsOk && evidence.tlsOk && evidence.ownershipOk;
}

export function projectDomainStatus(evidence: DomainEvidence) {
  return {
    status: domainIsUsable(evidence) ? "active" : "pending",
    publicVerified: domainIsUsable(evidence),
    providerStatus: evidence.providerStatus ?? null,
    providerPending: domainIsUsable(evidence) && evidence.providerStatus === "pending",
    checkedAt: evidence.checkedAt,
  };
}

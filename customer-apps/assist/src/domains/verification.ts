export type DomainEvidence = {
  dnsOk: boolean;
  tlsOk: boolean;
  ownershipOk: boolean;
  providerStatus?: string | null;
  observedTarget?: string | null;
  checkedAt: number;
};

export type VerifyDomainInput = {
  hostname: string;
  expectedTarget: string;
  expectedOwner: string;
  providerStatus?: string | null;
  fetchImpl?: typeof fetch;
};

export async function verifyDomainEvidence(input: VerifyDomainInput): Promise<DomainEvidence> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const hostname = input.hostname.toLowerCase().replace(/\.$/, "");
  const expectedTarget = input.expectedTarget.toLowerCase().replace(/\.$/, "");
  let observedTarget: string | null = null;

  try {
    const dns = await fetchImpl(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=CNAME`,
      { headers: { accept: "application/dns-json" } },
    );
    if (dns.ok) {
      const data: any = await dns.json();
      const cname = Array.isArray(data.Answer)
        ? data.Answer.find((a: any) => Number(a.type) === 5 && typeof a.data === "string")
        : null;
      observedTarget = cname?.data ? String(cname.data).toLowerCase().replace(/\.$/, "") : null;
    }
  } catch {
    // HTTPS tenant proof below can still establish public DNS for flattened records.
  }

  let tlsOk = false;
  let ownershipOk = false;
  try {
    const proof = await fetchImpl(`https://${hostname}/.well-known/mkety-assist-domain`, {
      redirect: "manual",
      headers: { accept: "application/json" },
    });
    tlsOk = proof.ok;
    if (proof.ok) {
      const body: any = await proof.json();
      ownershipOk = body?.service === "mkety-assist"
        && String(body?.hostname || "").toLowerCase() === hostname
        && String(body?.owner || "") === input.expectedOwner;
    }
  } catch {
    tlsOk = false;
    ownershipOk = false;
  }

  const cnameMatches = observedTarget === expectedTarget;
  // A valid HTTPS response from the correct Assist tenant proves public DNS routing even
  // when a DNS provider flattens the customer's CNAME and no CNAME RR is observable.
  const dnsOk = cnameMatches || (tlsOk && ownershipOk);
  return {
    dnsOk,
    tlsOk,
    ownershipOk,
    providerStatus: input.providerStatus ?? null,
    observedTarget,
    checkedAt: Math.floor(Date.now() / 1000),
  };
}

export function domainIsUsable(evidence: DomainEvidence) {
  return evidence.dnsOk && evidence.tlsOk && evidence.ownershipOk;
}

export function projectDomainStatus(evidence: DomainEvidence) {
  return {
    status: domainIsUsable(evidence) ? "active" : "pending",
    publicVerified: domainIsUsable(evidence),
    providerStatus: evidence.providerStatus ?? null,
    providerPending: domainIsUsable(evidence) && evidence.providerStatus === "pending",
    observedTarget: evidence.observedTarget ?? null,
    checkedAt: evidence.checkedAt,
  };
}

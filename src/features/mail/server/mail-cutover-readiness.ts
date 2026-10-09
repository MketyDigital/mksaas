export type MailCutoverCheck = {
  checkName: string;
  passed: boolean;
  evidenceRef: string | null;
  safeDetails: Record<string, unknown>;
};

export type MailCutoverReadinessInput = {
  tenantId: string;
  configuredTenantId: string;
  tenantSlug: string;
  domain: string;
  sendingReady: boolean;
  activeAddresses: string[];
  helloMailboxId: string | null;
  initialHelloImport: {
    status: string;
    mode: string;
    sourceMailboxAddress: string;
    destinationMailboxId: string;
    failedMessages: number;
  } | null;
  checks: MailCutoverCheck[];
};

export const REQUIRED_ROOT_MAILBOXES = [
  'billing@mkety.com',
  'cloudflare@mkety.com',
  'hello@mkety.com',
  'info@mkety.com',
  'support@mkety.com',
];

function checkPassed(checks: MailCutoverCheck[], name: string) {
  const check = checks.find((item) => item.checkName === name);
  return Boolean(check?.passed && check.evidenceRef?.trim());
}

function checkCoversAddresses(checks: MailCutoverCheck[], name: string, addresses: string[]) {
  const check = checks.find((item) => item.checkName === name);
  if (!check?.passed || !check.evidenceRef?.trim()) return false;
  const covered = Array.isArray(check.safeDetails.addresses)
    ? check.safeDetails.addresses
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.toLowerCase())
    : [];
  return addresses.every((address) => covered.includes(address));
}

export function evaluateMailCutoverReadiness(input: MailCutoverReadinessInput) {
  const missing: string[] = [];
  const addresses = [...new Set(input.activeAddresses.map((address) => address.toLowerCase()))].sort();
  const required = REQUIRED_ROOT_MAILBOXES.every((address) => addresses.includes(address));
  if (input.tenantId !== input.configuredTenantId || input.tenantSlug !== 'mkety-ops') missing.push('reserved_tenant');
  if (input.domain !== 'mkety.com') missing.push('root_domain');
  if (!required) missing.push('required_mailboxes');
  if (addresses.length !== input.activeAddresses.length) missing.push('duplicate_addresses');
  if (!input.sendingReady) missing.push('sending_authentication');

  const initial = input.initialHelloImport;
  if (
    !input.helloMailboxId ||
    !initial ||
    initial.status !== 'completed' ||
    !['initial', 'archive'].includes(initial.mode) ||
    initial.failedMessages !== 0 ||
    initial.sourceMailboxAddress.toLowerCase() !== 'hello@mkety.com' ||
    initial.destinationMailboxId !== input.helloMailboxId
  ) {
    missing.push('hello_initial_import');
  }
  if (!checkCoversAddresses(input.checks, 'temporary_inbound', addresses)) missing.push('temporary_inbound');
  if (!checkCoversAddresses(input.checks, 'outbound_acceptance', addresses)) missing.push('outbound_acceptance');
  if (!checkPassed(input.checks, 'rollback_rehearsal')) missing.push('rollback_rehearsal');
  return { ready: missing.length === 0, missing, addresses };
}

export function evaluateMailCutoverCompletion(checks: MailCutoverCheck[], addresses: string[]) {
  const normalized = [...new Set(addresses.map((address) => address.toLowerCase()))];
  const missing: string[] = [];
  if (!checkCoversAddresses(checks, 'post_cutover_inbound', normalized)) missing.push('post_cutover_inbound');
  if (!checkPassed(checks, 'hello_final_delta')) missing.push('hello_final_delta');
  return { ready: missing.length === 0, missing };
}

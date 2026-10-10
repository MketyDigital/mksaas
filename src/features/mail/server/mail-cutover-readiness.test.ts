import {
  evaluateMailCutoverCompletion,
  evaluateMailCutoverReadiness,
  type MailCutoverCheck,
  normalizeCloudflareMxTarget,
  REQUIRED_ROOT_MAILBOXES,
} from './mail-cutover-readiness';

const checks: MailCutoverCheck[] = [
  {
    checkName: 'temporary_inbound',
    passed: true,
    evidenceRef: 'test-run/inbound',
    safeDetails: { addresses: REQUIRED_ROOT_MAILBOXES },
  },
  {
    checkName: 'outbound_acceptance',
    passed: true,
    evidenceRef: 'test-run/outbound',
    safeDetails: { addresses: REQUIRED_ROOT_MAILBOXES },
  },
  { checkName: 'rollback_rehearsal', passed: true, evidenceRef: 'ops/rollback-run', safeDetails: {} },
];

const readyInput = {
  tenantId: 'reserved',
  configuredTenantId: 'reserved',
  tenantSlug: 'mkety-ops',
  domain: 'mkety.com',
  sendingReady: true,
  activeAddresses: [...REQUIRED_ROOT_MAILBOXES],
  helloMailboxId: 'hello-mailbox',
  initialHelloImport: {
    status: 'completed',
    mode: 'initial',
    sourceMailboxAddress: 'hello@mkety.com',
    destinationMailboxId: 'hello-mailbox',
    failedMessages: 0,
  },
  checks,
};

describe('first-party Mail root cutover gates', () => {
  test('accepts only an MX target under the exact Cloudflare mail domain', () => {
    expect(normalizeCloudflareMxTarget('10 route1.mx.cloudflare.net.')).toBe('route1.mx.cloudflare.net');
    expect(normalizeCloudflareMxTarget('attacker.example route1.mx.cloudflare.net.attacker.example')).toBe('');
    expect(normalizeCloudflareMxTarget('https://route1.mx.cloudflare.net.attacker.example')).toBe('');
  });

  test('requires the complete mailbox inventory, hello import, send/receive tests, auth and rollback evidence', () => {
    expect(evaluateMailCutoverReadiness(readyInput).ready).toBe(true);
    expect(
      evaluateMailCutoverReadiness({ ...readyInput, activeAddresses: readyInput.activeAddresses.slice(1) }).missing,
    ).toContain('required_mailboxes');
    expect(evaluateMailCutoverReadiness({ ...readyInput, tenantSlug: 'customer' }).missing).toContain(
      'reserved_tenant',
    );
    expect(
      evaluateMailCutoverReadiness({
        ...readyInput,
        initialHelloImport: { ...readyInput.initialHelloImport, failedMessages: 1 },
      }).missing,
    ).toContain('hello_initial_import');
    expect(evaluateMailCutoverReadiness({ ...readyInput, checks: checks.slice(1) }).missing).toContain(
      'temporary_inbound',
    );
    expect(
      evaluateMailCutoverReadiness({ ...readyInput, checks: checks.map((check) => ({ ...check, evidenceRef: null })) })
        .missing,
    ).toContain('rollback_rehearsal');
  });

  test('requires a live test for every root address and a final hello delta before completion', () => {
    const postChecks: MailCutoverCheck[] = [
      {
        checkName: 'post_cutover_inbound',
        passed: true,
        evidenceRef: 'test-run/live-inbound',
        safeDetails: { addresses: REQUIRED_ROOT_MAILBOXES },
      },
      { checkName: 'hello_final_delta', passed: true, evidenceRef: 'migration-run/delta', safeDetails: {} },
    ];
    expect(evaluateMailCutoverCompletion(postChecks, REQUIRED_ROOT_MAILBOXES).ready).toBe(true);
    expect(evaluateMailCutoverCompletion(postChecks.slice(0, 1), REQUIRED_ROOT_MAILBOXES).missing).toContain(
      'hello_final_delta',
    );
  });
});

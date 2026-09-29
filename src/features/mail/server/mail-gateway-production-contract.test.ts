import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

describe('Mkety Mail gateway production contract', () => {
  const root = process.cwd();
  const gatewayPath = path.join(root, 'ops/mail-gateway/gateway.mjs');
  const workflowPath = path.join(root, '.github/workflows/mkety-mail-gateway-production.yml');
  const gateway = fs.readFileSync(gatewayPath, 'utf8');
  const workflow = fs.readFileSync(workflowPath, 'utf8');

  it('keeps the gateway runtime syntax-valid and stateless', () => {
    const check = spawnSync(process.execPath, ['--check', gatewayPath], { encoding: 'utf8' });
    expect(check.status).toBe(0);
    expect(check.stderr).toBe('');
    expect(gateway).toContain("MKETY_MAIL_GATEWAY_API_BASE_URL");
    expect(gateway).toContain("MKETY_MAIL_GATEWAY_INTERNAL_SECRET");
    expect(gateway).not.toContain('DATABASE_URL');
    expect(gateway).not.toContain('postgres');
  });

  it('exposes only health, IMAPS and SMTPS with lightweight limits', () => {
    expect(workflow).toContain("ports_exposes:'8080,993,465'");
    expect(workflow).toContain("ports_mappings:'993:993,465:465'");
    expect(workflow).toContain("limits_cpus:'0.25'");
    expect(workflow).toContain("limits_memory:'128m'");
  });

  it('requires the exact SHA and successful Mail production first', () => {
    expect(workflow).toContain("verify_success mkety-mail-production.yml Mail-Production");
    expect(workflow).toContain("Refusing stale Mail gateway deployment.");
    expect(workflow).toContain("[mail-gateway-production]");
  });

  it('checks for an existing managed service before taking the TCP endpoints', () => {
    expect(workflow).toContain('Diagnose any existing Mail gateway before mutation');
    expect(workflow).toContain('Trusted Mail TCP service exists but is not the managed Mkety gateway; refusing takeover.');
  });

  it('requires publicly trusted TLS and protocol greetings', () => {
    expect(workflow).toContain('openssl s_client -connect "$host:$port"');
    expect(workflow).toContain("grep -Fq 'IMAP4rev1'");
    expect(workflow).toContain("grep -Fq '250-AUTH PLAIN LOGIN'");
    expect(workflow).toContain('Gateway internal API expected fail-closed 401');
  });

  it('does not silently expose external clients before functional acceptance', () => {
    expect(workflow).not.toContain('MKETY_MAIL_EXTERNAL_CLIENTS_ENABLED=true');
    expect(workflow).toContain('external-client feature flag remains OFF');
  });

  it('renews TLS without pinning the gateway to a new code SHA', () => {
    expect(workflow).toContain('renew-certificate:');
    expect(workflow).toContain('Mail gateway certificate renewed on the existing pinned gateway application.');
  });
});

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

describe('Mkety Mail gateway production contract', () => {
  const root = process.cwd();
  const gatewayPath = path.join(root, 'ops/mail-gateway/gateway.mjs');
  const workflowPath = path.join(root, '.github/workflows/mkety-mail-gateway-production.yml');
  const gateway = fs.readFileSync(gatewayPath, 'utf8');
  const workflow = fs.readFileSync(workflowPath, 'utf8');
  const gatewayAuth = fs.readFileSync(
    path.join(root, 'src/features/mail/server/gateway-auth.ts'),
    'utf8',
  );

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

  it('resolves the Coolify server address safely before publishing Mail DNS', () => {
    expect(workflow).toContain('/servers/$SERVER_UUID/domains');
    expect(workflow).toContain('Always');
    expect(workflow).toContain('domain_server_address=');
    expect(workflow).toContain("const values=[]");
    expect(workflow).toContain("const isPublic=(ip)=>");
    expect(workflow).toContain("value.match(/(?:\\d{1,3}\\.){3}\\d{1,3}/g)");
    expect(workflow).toContain('normalize_server_host');
    expect(workflow).toContain('getent ahostsv4');
    expect(workflow).toContain('Coolify server payload exposed no public IPv4');
  });

  it('reconciles supported host firewalls when direct SSH is reachable', () => {
    expect(workflow).toContain('Reconcile host firewall when direct SSH is reachable');
    expect(workflow).toContain('/security/keys/$key_uuid');
    expect(workflow).toContain("ufw allow 993/tcp");
    expect(workflow).toContain("ufw allow 465/tcp");
    expect(workflow).toContain("firewall-cmd --permanent --add-port=993/tcp");
    expect(workflow).toContain("firewall-cmd --permanent --add-port=465/tcp");
    expect(workflow).toContain("Host does not show published listeners for 993/465");
    expect(workflow).toContain('Optional host-firewall reconciliation returned exit');
    expect(workflow).toContain('continuing to authoritative OCI NSG reconciliation');
  });

  it('uses a dedicated OCI NSG for provider-level Mail ingress', () => {
    expect(workflow).toContain('Reconcile dedicated OCI NSG ingress for Mail gateway');
    expect(workflow).toContain('oci network public-ip get --public-ip-address "$SERVER_IP"');
    expect(workflow).toContain("nsg_name='mkety-mail-gateway-ingress'");
    expect(workflow).toContain("source:'0.0.0.0/0'");
    expect(workflow).toContain("destinationPortRange:{min:port,max:port}");
    expect(workflow).toContain('oci network vnic update --vnic-id "$vnic_id" --nsg-ids');
    expect(workflow).toContain('Dedicated OCI NSG is attached to the gateway VNIC with TCP 993/465 ingress only.');
  });

  it('requires authoritative/public DNS plus trusted origin TLS and protocol greetings', () => {
    expect(workflow).toContain('Accept public DNS, TLS and protocol greetings');
    expect(workflow).toContain("r.proxied===false");
    expect(workflow).toContain('https://cloudflare-dns.com/dns-query');
    expect(workflow).toContain('openssl s_client -connect "$SERVER_IP:$port"');
    expect(workflow).toContain('-verify_hostname "$host"');
    expect(workflow).toContain("grep -Fq 'IMAP4rev1'");
    expect(workflow).toContain("grep -Fq '250-AUTH PLAIN LOGIN'");
    expect(workflow).toContain('Gateway internal API expected fail-closed 401');
  });


  it('rechecks active Mail commercial access for every external-client login', () => {
    expect(gatewayAuth).toContain("entitlement: 'workspace.mail'");
    expect(gatewayAuth).toContain("eq(mailWorkspaces.status, 'active')");
    expect(gatewayAuth).toContain('if (!workspace || !entitled || !mailbox) return null;');
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

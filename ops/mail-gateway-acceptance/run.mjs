import http from 'node:http';
import crypto from 'node:crypto';
import postgres from 'postgres';

const databaseUrl = process.env.DATABASE_URL || '';
const mode = (process.env.MKETY_MAIL_ACCEPTANCE_MODE || 'setup').trim();
const runId = (process.env.MKETY_MAIL_ACCEPTANCE_RUN_ID || '').replace(/[^0-9A-Za-z_-]/g, '').slice(0, 80);
const secret = process.env.MKETY_MAIL_ACCEPTANCE_APP_PASSWORD || '';

if (!databaseUrl || !runId) throw new Error('Acceptance DATABASE_URL and run id are required.');
if ((mode === 'setup' || mode === 'revoke') && !secret.startsWith('mkmail-')) {
  throw new Error('Acceptance app password must use the Mkety app-password prefix.');
}

const sql = postgres(databaseUrl, { max: 1, prepare: false });
const slug = `mail-gateway-acceptance-${runId.toLowerCase()}`.slice(0, 100);
const userId = `mail-acceptance-${runId}`;
const userEmail = `${slug}@acceptance.mkety.invalid`;
const domainName = `${slug}.mkety.invalid`;
const address = `client@${domainName}`;
const suppressedRecipient = `sink-${runId}@example.invalid`;

function appPasswordHash(value) {
  const salt = crypto.randomBytes(16);
  const digest = crypto.createHash('sha256').update(Buffer.concat([Buffer.from(value, 'utf8'), salt])).digest();
  return '{SSHA256}' + Buffer.concat([digest, salt]).toString('base64');
}

async function cleanup() {
  const rows = await sql`select id from saas_template.tenants where slug = ${slug} limit 1`;
  if (rows[0]?.id) await sql`delete from saas_template.tenants where id = ${rows[0].id}`;
  await sql`delete from saas_template.users where id = ${userId}`;
}

async function setup() {
  await cleanup();
  const tenantId = crypto.randomUUID();
  const workspaceId = crypto.randomUUID();
  const domainId = crypto.randomUUID();
  const mailboxId = crypto.randomUUID();

  await sql.begin(async (tx) => {
    await tx`insert into saas_template.tenants (id, slug, name) values (${tenantId}, ${slug}, 'Mkety Mail Gateway Acceptance')`;
    await tx`insert into saas_template.users (id, name, email) values (${userId}, 'Mail Gateway Acceptance', ${userEmail})`;
    await tx`insert into saas_template.tenant_entitlement_overrides
      (tenant_id, entitlement_key, effect, reason, source)
      values (${tenantId}, 'workspace.mail', 'grant', 'Synthetic production gateway acceptance', 'mail-gateway-acceptance')`;
    await tx`insert into saas_template.mail_workspaces
      (id, tenant_id, status, plan_key, onboarding_step)
      values (${workspaceId}, ${tenantId}, 'active', 'starter', 'complete')`;
    await tx`insert into saas_template.mail_domains
      (id, tenant_id, workspace_id, domain, status, sending_enabled, routing_enabled, spf_status, dkim_status, dmarc_status, mx_status, verified_at)
      values (${domainId}, ${tenantId}, ${workspaceId}, ${domainName}, 'verified', true, true, 'verified', 'verified', 'verified', 'verified', now())`;
    await tx`insert into saas_template.mail_mailboxes
      (id, tenant_id, workspace_id, domain_id, local_part, display_name, status, created_by_user_id)
      values (${mailboxId}, ${tenantId}, ${workspaceId}, ${domainId}, 'client', 'Gateway Acceptance', 'active', ${userId})`;
    await tx`insert into saas_template.mail_app_passwords
      (tenant_id, mailbox_id, user_id, name, password_prefix, password_hash)
      values (${tenantId}, ${mailboxId}, ${userId}, 'Synthetic acceptance', ${secret.slice(0, 12)}, ${appPasswordHash(secret)})`;
    await tx`insert into saas_template.mail_messages
      (tenant_id, mailbox_id, direction, from_address, to_json, subject, preview, status, folder, received_at)
      values (${tenantId}, ${mailboxId}, 'inbound', 'fixture@example.invalid', ${tx.json([address])}, 'Mkety gateway acceptance fixture', 'Synthetic acceptance message', 'delivered', 'inbox', now())`;
    await tx`insert into saas_template.mail_suppressions
      (tenant_id, domain_id, email, reason, source)
      values (${tenantId}, ${domainId}, ${suppressedRecipient}, 'acceptance', 'mail-gateway-acceptance')`;
  });
}

async function revoke() {
  const tenant = await sql`select id from saas_template.tenants where slug = ${slug} limit 1`;
  if (!tenant[0]?.id) throw new Error('Acceptance tenant not found for revocation.');
  const result = await sql`update saas_template.mail_app_passwords
    set revoked_at = now()
    where tenant_id = ${tenant[0].id} and revoked_at is null
    returning id`;
  if (!result.length) throw new Error('Acceptance credential was not revoked.');
}

function sanitizeDiagnostic(value) {
  return String(value || '')
    .replace(/postgres(?:ql)?:\\/\\/[^\\s]+/gi, 'postgresql://***')
    .replace(/mkmail-[0-9a-f]+/gi, 'mkmail-***')
    .replace(/password\\s*[=:]\\s*[^\\s]+/gi, 'password=***')
    .slice(0, 2000);
}

let acceptanceError = null;
try {
  if (mode === 'setup') {
    await setup();
    console.log('MKETY_MAIL_FUNCTIONAL_FIXTURE_READY=true');
  } else if (mode === 'revoke') {
    await revoke();
    console.log('MKETY_MAIL_FUNCTIONAL_CREDENTIAL_REVOKED=true');
  } else if (mode === 'cleanup') {
    await cleanup();
    console.log('MKETY_MAIL_FUNCTIONAL_FIXTURE_CLEANED=true');
  } else {
    throw new Error('Unsupported acceptance mode.');
  }
} catch (error) {
  acceptanceError = error;
  const name = error instanceof Error ? error.name : 'Error';
  const message = error instanceof Error ? error.message : String(error);
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code || '') : '';
  console.error(
    'MKETY_MAIL_FUNCTIONAL_FIXTURE_ERROR=' +
      sanitizeDiagnostic(JSON.stringify({ name, code, message })),
  );
}

await sql.end({ timeout: 5 }).catch((error) => {
  if (!acceptanceError) {
    acceptanceError = error;
    console.error(
      'MKETY_MAIL_FUNCTIONAL_FIXTURE_ERROR=' +
        sanitizeDiagnostic(JSON.stringify({
          name: error instanceof Error ? error.name : 'Error',
          code: error && typeof error === 'object' && 'code' in error ? String(error.code || '') : '',
          message: error instanceof Error ? error.message : String(error),
        })),
    );
  }
});

http.createServer((_req, res) => {
  res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify({ ok: !acceptanceError, mode }));
}).listen(3000, '0.0.0.0');

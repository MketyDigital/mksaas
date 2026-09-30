import postgres from 'postgres';
import crypto from 'node:crypto';
import http from 'node:http';

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

function verifyAppPasswordHash(value, encoded) {
  if (!String(encoded || '').startsWith('{SSHA256}')) return false;
  const decoded = Buffer.from(String(encoded).slice('{SSHA256}'.length), 'base64');
  if (decoded.length <= 32) return false;
  const digest = decoded.subarray(0, 32);
  const salt = decoded.subarray(32);
  const actual = crypto
    .createHash('sha256')
    .update(Buffer.concat([Buffer.from(value, 'utf8'), salt]))
    .digest();
  return digest.length === actual.length && crypto.timingSafeEqual(digest, actual);
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

async function verifyAuthFixture() {
  const tenantRows = await sql`
    select id
    from saas_template.tenants
    where slug = ${slug}
    limit 1
  `;
  const tenantId = tenantRows[0]?.id;
  if (!tenantId) throw new Error('auth_diag_tenant_missing');
  console.log('MKETY_MAIL_FUNCTIONAL_AUTH_DIAG=tenant:ok');

  const domainRows = await sql`
    select id, tenant_id, sending_enabled, routing_enabled
    from saas_template.mail_domains
    where domain = ${domainName}
    limit 1
  `;
  const domain = domainRows[0];
  if (!domain || domain.tenant_id !== tenantId) throw new Error('auth_diag_domain_missing');
  console.log('MKETY_MAIL_FUNCTIONAL_AUTH_DIAG=domain:ok');

  const workspaceRows = await sql`
    select id
    from saas_template.mail_workspaces
    where tenant_id = ${tenantId} and status = 'active'
    limit 1
  `;
  if (!workspaceRows[0]?.id) throw new Error('auth_diag_workspace_missing');
  console.log('MKETY_MAIL_FUNCTIONAL_AUTH_DIAG=workspace:ok');

  const mailboxRows = await sql`
    select id, domain_id, local_part, status
    from saas_template.mail_mailboxes
    where tenant_id = ${tenantId}
      and domain_id = ${domain.id}
      and local_part = 'client'
      and status = 'active'
    limit 1
  `;
  const mailbox = mailboxRows[0];
  if (!mailbox?.id) throw new Error('auth_diag_mailbox_missing');
  console.log('MKETY_MAIL_FUNCTIONAL_AUTH_DIAG=mailbox:ok');

  const subscriptionRows = await sql`
    select plan_version_id
    from saas_template.billing_subscriptions
    where tenant_id = ${tenantId}
      and (
        (
          status in ('trialing', 'active')
          and (current_period_end is null or current_period_end > now())
        )
        or (status = 'cancel_at_period_end' and current_period_end > now())
        or (status = 'past_due' and grace_period_end > now())
      )
    order by updated_at desc
  `;
  for (const row of subscriptionRows) {
    await sql`
      select entitlement_key, enabled
      from saas_template.billing_plan_version_entitlements
      where plan_version_id = ${row.plan_version_id}
    `;
  }

  const overrideRows = await sql`
    select entitlement_key, effect, expires_at
    from saas_template.tenant_entitlement_overrides
    where tenant_id = ${tenantId}
  `;
  const now = Date.now();
  const mailOverrides = overrideRows.filter((row) =>
    row.entitlement_key === 'workspace.mail'
    && (!row.expires_at || new Date(row.expires_at).getTime() > now)
  );
  if (mailOverrides.some((row) => row.effect === 'deny')) throw new Error('auth_diag_entitlement_denied');
  if (!mailOverrides.some((row) => row.effect === 'grant')) throw new Error('auth_diag_entitlement_missing');
  console.log('MKETY_MAIL_FUNCTIONAL_AUTH_DIAG=entitlement:ok');

  const credentialRows = await sql`
    select id, password_prefix, password_hash, revoked_at
    from saas_template.mail_app_passwords
    where tenant_id = ${tenantId}
      and mailbox_id = ${mailbox.id}
      and revoked_at is null
  `;
  const credential = credentialRows.find((row) =>
    secret.startsWith(String(row.password_prefix || ''))
    && verifyAppPasswordHash(secret, row.password_hash)
  );
  if (!credential?.id) throw new Error('auth_diag_credential_hash_mismatch');
  console.log('MKETY_MAIL_FUNCTIONAL_AUTH_DIAG=credential:ok');

  const used = await sql`
    update saas_template.mail_app_passwords
    set last_used_at = now()
    where id = ${credential.id}
    returning id
  `;
  if (!used[0]?.id) throw new Error('auth_diag_last_used_update_failed');
  console.log('MKETY_MAIL_FUNCTIONAL_AUTH_DIAG=credential_update:ok');

  const messageRows = await sql`
    select id, imap_uid, subject
    from saas_template.mail_messages
    where tenant_id = ${tenantId}
      and mailbox_id = ${mailbox.id}
      and folder = 'inbox'
      and imap_uid > 0
    order by imap_uid asc
    limit 10
  `;
  if (!messageRows.some((row) => row.subject === 'Mkety gateway acceptance fixture')) {
    throw new Error('auth_diag_message_index_missing');
  }
  console.log('MKETY_MAIL_FUNCTIONAL_AUTH_DIAG=message_index:ok');
  console.log('MKETY_MAIL_FUNCTIONAL_AUTH_DB_DIAG_OK=true');
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
    .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, 'postgresql://***')
    .replace(/mkmail-[0-9a-f]+/gi, 'mkmail-***')
    .replace(/password\s*[=:]\s*[^\s]+/gi, 'password=***')
    .slice(0, 2000);
}

let acceptanceError = null;
let acceptanceReady = false;

const server = http.createServer((_req, res) => {
  res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify({ ok: !acceptanceError, ready: acceptanceReady, mode }));
});

await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(3000, '0.0.0.0', resolve);
});
console.log('MKETY_MAIL_FUNCTIONAL_HEALTH_READY=true');

try {
  if (mode === 'setup') {
    await setup();
    await verifyAuthFixture();
    acceptanceReady = true;
    console.log('MKETY_MAIL_FUNCTIONAL_FIXTURE_READY=true');
  } else if (mode === 'revoke') {
    await revoke();
    acceptanceReady = true;
    console.log('MKETY_MAIL_FUNCTIONAL_CREDENTIAL_REVOKED=true');
  } else if (mode === 'cleanup') {
    await cleanup();
    acceptanceReady = true;
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
